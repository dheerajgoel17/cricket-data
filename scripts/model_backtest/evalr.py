import pandas as pd, numpy as np
P=pd.concat([pd.read_parquet('preds_player.parquet'),pd.read_parquet('preds_match.parquet')])
P['inn']=P.inn.astype(int)
BE=1/1.9; MARG=[0,.02,.04,.06,.08,.10,.15]
def cal(t):
    p,y=t.p.values,t.y.values; bins=np.clip((p*10).astype(int),0,9)
    ece=sum(abs(p[bins==b].mean()-y[bins==b].mean())*(bins==b).mean() for b in range(10) if (bins==b).any())
    return pd.Series({'n':len(t),'hit':y.mean(),'brier':((p-y)**2).mean(),'logloss':-(y*np.log(p)+(1-y)*np.log(1-p)).mean(),'ece':ece})
C=P.groupby(['stat','fmt','line','model']).apply(cal).reset_index()
C.to_csv('calibration.csv',index=False)
def roi(t,side,mg):
    if side=='over': s=t[t.p>BE+mg]; w=s.y
    else: s=t[(1-t.p)>BE+mg]; w=1-s.y
    n=len(s); return n,(w.sum()*0.9-(n-w.sum()))/n if n else np.nan
R=[]
for k,t in P.groupby(['stat','fmt','line','model']):
    for per,tt in (('val',t[t.year<=2023]),('test',t[t.year>=2024])):
        for side in ('over','under'):
            for mg in MARG:
                n,r=roi(tt,side,mg); R.append((*k,per,side,mg,n,r))
R=pd.DataFrame(R,columns=['stat','fmt','line','model','period','side','margin','n','roi'])
R.to_csv('roi_grid.csv',index=False)
# pick strategy per (stat,fmt,line) on val (n>=150), report test
v=R[(R.period=='val')&(R.n>=150)].sort_values('roi',ascending=False).groupby(['stat','fmt','line']).head(1)
te=R[R.period=='test'].set_index(['stat','fmt','line','model','side','margin'])
v['test_n']=[te.loc[tuple(x),'n'] for x in v[['stat','fmt','line','model','side','margin']].values]
v['test_roi']=[te.loc[tuple(x),'roi'] for x in v[['stat','fmt','line','model','side','margin']].values]
v.to_csv('selected.csv',index=False)
pd.set_option('display.width',250); pd.set_option('display.max_rows',500)
print(v.round(3).to_string(index=False))
best=C.sort_values('logloss').groupby(['stat','fmt','line']).head(1)
print(best.round(4).to_string(index=False))
