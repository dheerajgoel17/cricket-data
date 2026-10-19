import pandas as pd, numpy as np, lightgbm as lgb, warnings
from bt import nb_sf, fit_alpha, fair_line
from scipy.stats import norm
warnings.filterwarnings('ignore')
m=pd.read_parquet('match.parquet'); bat=pd.read_parquet('bat.parquet',columns=['mid','team','inn'])
t=bat.drop_duplicates(['mid','team']).sort_values(['mid','inn'])
tt=t.groupby('mid').team.agg(list); m=m[m.mid.isin(tt.index)&(m.fmt!='Test')].copy()
m['t1']=m.mid.map(lambda x:tt[x][0]); m['t2']=m.mid.map(lambda x:tt[x][-1] if len(tt[x])>1 else None)
need={'T20':96,'ODI':240}
m['valid']=m.apply(lambda r:len(r.balls)>=2 and min(r.balls[:2])>=need[r.fmt],axis=1)
ST=['fours','sixes','thirties','dd','max_conc','hi_over','top_bat']
m=m.sort_values('date').reset_index(drop=True)
for s in ST:
    m[f'v_{s}']=m.groupby(['venue','fmt','g'])[s].transform(lambda x:x.shift().ewm(halflife=10,min_periods=1).mean())
    m[f'all_{s}']=m.groupby(['fmt','g','intl'])[s].transform(lambda x:x.shift().ewm(halflife=50,min_periods=1).mean())
    long=pd.concat([m[['mid','date','fmt','g','t1',s]].rename(columns={'t1':'tm'}),m[['mid','date','fmt','g','t2',s]].rename(columns={'t2':'tm'})]).sort_values('date')
    long[f'tm_{s}']=long.groupby(['tm','fmt','g'])[s].transform(lambda x:x.shift().ewm(halflife=8,min_periods=1).mean())
    a=long.drop_duplicates(['mid','tm'])
    m=m.merge(a[['mid','tm',f'tm_{s}']].rename(columns={'tm':'t1',f'tm_{s}':f't1_{s}'}),on=['mid','t1'],how='left')
    m=m.merge(a[['mid','tm',f'tm_{s}']].rename(columns={'tm':'t2',f'tm_{s}':f't2_{s}'}),on=['mid','t2'],how='left')
m['year']=m.date.str[:4].astype(int); m['gf']=(m.g=='female').astype(int); m['intl']=m.intl.astype(int)
rows=[]
for s in ST:
    d=m[m.valid].copy()
    d['form']=d[[f'v_{s}',f't1_{s}',f't2_{s}']].mean(axis=1).fillna(d[f'all_{s}'])
    d['naive']=d[f'all_{s}']
    d=d[d.form.notna()]
    X=[f'v_{s}',f't1_{s}',f't2_{s}',f'all_{s}','gf','intl']
    for fmt,dd in d.groupby('fmt'):
        for yr in range(2020,2027):
            tr=dd[dd.year<yr]; te=dd[dd.year==yr].copy()
            if len(te)<50: continue
            g=lgb.LGBMRegressor(objective='poisson',n_estimators=200,learning_rate=.05,num_leaves=15,min_child_samples=50,verbose=-1).fit(tr[X],tr[s])
            mu=np.maximum(g.predict(te[X]),.1); mtr=np.maximum(g.predict(tr[X]),.1)
            ag=fit_alpha(tr[s].values,mtr); af=fit_alpha(tr[s].values,np.maximum(tr.form.values,.1)); an=fit_alpha(tr[s].values,np.maximum(tr.naive.values,.1))
            for lname,line in {'fair_form':fair_line(te.form.values,af).values,'proxy_form':np.floor(te.form)+0.5,'proxy_global':np.floor(te.naive)+0.5}.items():
                y=(te[s]>line).astype(int).values
                for mn,p in {'naive_nb':nb_sf(line,te.naive,an),'form_nb':nb_sf(line,te.form,af),'gbm_nb':nb_sf(line,mu,ag)}.items():
                    rows.append(pd.DataFrame({'fmt':fmt,'year':yr,'y':y,'p':np.clip(p,1e-4,1-1e-4),'intl':te.intl.values,'inn':-1,'g':te.g.values,
                        'stat':'match_'+s,'kind':'match','line':lname,'model':mn}))
pd.concat(rows).to_parquet('preds_match.parquet'); print('ok')
