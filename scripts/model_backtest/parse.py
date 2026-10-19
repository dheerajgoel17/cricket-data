import zipfile, json, sys, pandas as pd
from concurrent.futures import ProcessPoolExecutor
import os
Z=os.environ.get('CRICSHEET_ZIP','all_json.zip')  # https://cricsheet.org/downloads/all_json.zip
FMT={'T20':'T20','IT20':'T20','ODI':'ODI','ODM':'ODI','Test':'Test'}
def parse(name):
    try:
        with zipfile.ZipFile(Z) as z: d=json.loads(z.read(name))
    except Exception: return None
    i=d['info']; f=FMT.get(i.get('match_type'))
    if not f: return None
    date=i['dates'][0]
    if date<'2014-01-01': return None
    mid=name[:-5]; teams=i['teams']; venue=i.get('venue',''); g=i.get('gender')
    intl=i.get('team_type')=='international'; ev=(i.get('event') or {}).get('name','')
    bat=[];bowl=[]; inns=d.get('innings',[])
    agg={'mid':mid,'date':date,'fmt':f,'g':g,'venue':venue,'intl':intl,'event':ev,
         'bat_first':inns[0]['team'] if inns else None,'result':'result' not in i.get('outcome',{}) and 'winner' in i.get('outcome',{}),
         'n_inns':len(inns)}
    tot_balls=[];hi_over=0;f4=f6=0;maxconc=0
    for k,inn in enumerate(inns):
        if inn.get('super_over'): continue
        team=inn['team']; opp=[t for t in teams if t!=team][0]
        B={};order=[];W={}; legal=0
        for ov in inn.get('overs',[]):
            orun=0
            for dl in ov['deliveries']:
                for p in (dl['batter'],dl['non_striker']):
                    if p not in B: B[p]=[0,0,0,0,0]; order.append(p)
                r=dl['runs']; ex=dl.get('extras',{})
                b=B[dl['batter']]; b[0]+=r['batter']
                if 'wides' not in ex: b[1]+=1
                if r['batter']==4 and not r.get('non_boundary'): b[2]+=1
                if r['batter']==6: b[3]+=1
                w=W.setdefault(dl['bowler'],[0,0,0])
                w[1]+=r['batter']+ex.get('wides',0)+ex.get('noballs',0)
                if 'wides' not in ex and 'noballs' not in ex: w[2]+=1; legal+=1
                orun+=r['total']
                for wk in dl.get('wickets',[]):
                    if wk['kind'] not in ('run out','retired hurt','retired out','obstructing the field','retired not out'): w[0]+=1
                    if wk['player_out'] in B and wk['kind']!='retired hurt': B[wk['player_out']][4]=1
            hi_over=max(hi_over,orun)
        tot_balls.append(legal)
        for pos,p in enumerate(order):
            b=B[p]; f4+=b[2]; f6+=b[3]
            bat.append((mid,date,f,g,venue,intl,team,opp,k,pos+1,p,*b))
        for p,w in W.items():
            maxconc=max(maxconc,w[1])
            bowl.append((mid,date,f,g,venue,intl,team if False else opp,team,k,p,*w))
    sc=[x[11] for x in bat]
    agg.update(fours=f4,sixes=f6,thirties=sum(30<=s<50 for s in sc),dd=sum(s>=10 for s in sc),
               top_bat=max(sc) if sc else 0,max_conc=maxconc,hi_over=hi_over,balls=tot_balls,
               fifties=sum(50<=s<100 for s in sc),ducks=sum(1 for x in bat if x[11]==0 and x[15]==1))
    return bat,bowl,agg
if __name__=='__main__':
    with zipfile.ZipFile(Z) as z: names=[n for n in z.namelist() if n.endswith('.json')]
    B=[];W=[];A=[]
    with ProcessPoolExecutor(6) as ex:
        for r in ex.map(parse,names,chunksize=50):
            if r: B+=r[0];W+=r[1];A.append(r[2])
    pd.DataFrame(B,columns='mid date fmt g venue intl team opp inn pos player runs balls fours sixes out'.split()).to_parquet('bat.parquet')
    pd.DataFrame(W,columns='mid date fmt g venue intl team opp inn player wkts conc bb'.split()).to_parquet('bowl.parquet')
    pd.DataFrame(A).to_parquet('match.parquet')
    print(len(B),len(W),len(A))
