import pandas as pd, numpy as np, lightgbm as lgb, warnings, sys
from scipy.stats import nbinom, poisson
warnings.filterwarnings('ignore')
ODDS=1.90; BE=1/ODDS
FIXED={'runs':[9.5,19.5,29.5],'balls':[14.5,24.5],'fours':[1.5,2.5],'sixes':[0.5,1.5],'wkts':[0.5,1.5],'conc':[24.5,44.5]}
def nb_sf(line,mu,a):
    mu=np.maximum(mu,1e-3); r=1/a; return nbinom.sf(np.floor(line),r,r/(r+mu))
def fit_alpha(y,mu):
    from scipy.special import gammaln
    best=None
    for a in np.exp(np.linspace(np.log(.01),np.log(5),50)):
        r=1/a; ll=(gammaln(y+r)-gammaln(r)+r*np.log(r/(r+mu))+y*np.log(mu/(r+mu)+1e-12)).sum()
        if best is None or ll>best[0]: best=(ll,a)
    return best[1]
def fair_line(mu,a):
    mu=np.maximum(np.asarray(mu,float),1e-3); r=1/np.asarray(a,float); md=nbinom.ppf(0.5,r,r/(r+mu))
    lo=md-0.5; hi=md+0.5
    plo=nbinom.sf(np.floor(lo),r,r/(r+mu)); phi=nbinom.sf(np.floor(hi),r,r/(r+mu))
    return pd.Series(np.where(np.abs(plo-.5)<np.abs(phi-.5),np.maximum(lo,0.5),hi))
def run(df,stat,feat_cols,kind):
    df=df[(df.n_prev>=5)&df[f'f_{stat}'].notna()&df[f'med_{stat}'].notna()].copy()
    df['year']=df.date.str[:4].astype(int); df['gf']=(df.g=='female').astype(int); df['intl']=df.intl.astype(int)
    X=feat_cols+['gf','intl','inn','n_prev']
    out=[]
    for fmt,d in df.groupby('fmt'):
        for yr in range(2020,2027):
            tr=d[d.year<yr]; te=d[d.year==yr].copy()
            if len(te)<200 or len(tr)<2000: continue
            m=lgb.LGBMRegressor(objective='poisson',n_estimators=300,learning_rate=0.05,num_leaves=31,min_child_samples=100,subsample=.8,subsample_freq=1,colsample_bytree=.8,verbose=-1)
            m.fit(tr[X],tr[stat]); mu_tr=np.maximum(m.predict(tr[X]),1e-3)
            a_g=fit_alpha(tr[stat].values,mu_tr)
            a_f=fit_alpha(tr[stat].values,np.maximum(tr[f'f_{stat}'].values,1e-3))
            a_m=fit_alpha(tr[stat].values,np.maximum(tr[f'mix_{stat}'].fillna(tr[f'f_{stat}']).values,1e-3))
            te['mu_gbm']=np.maximum(m.predict(te[X]),1e-3)
            # simple bias-corrected form (calibrate scale on train)
            k=tr[stat].mean()/max(tr[f'f_{stat}'].mean(),1e-3); te['k']=k
            te['a_g'],te['a_f'],te['a_m']=a_g,a_f,a_m
            out.append(te)
    r=pd.concat(out)
    rows=[]
    linesets={'median':np.floor(r[f'med_{stat}'])+0.5,'mean':np.floor(r[f'f_{stat}'])+0.5}
    for L in FIXED[stat]: linesets[f'fixed{L}']=pd.Series(L,index=r.index)
    linesets['fair_form']=fair_line(r[f'f_{stat}']*r.k,r.a_f)
    for lname,line in linesets.items():
        line=pd.Series(np.asarray(line,float),index=r.index)
        y=(r[stat]>line).astype(int)
        P={'form_pois':poisson.sf(np.floor(line),np.maximum(r[f'f_{stat}'],1e-3)),
           'form_nb':nb_sf(line,r[f'f_{stat}']*r.k,r.a_f),
           'legacy_mixfmt_nb':nb_sf(line,r[f'mix_{stat}'].fillna(r[f'f_{stat}']),r.a_m),
           'gbm_nb':nb_sf(line,r.mu_gbm,r.a_g)}
        P['blend']=0.5*P['form_nb']+0.5*P['gbm_nb']
        P['base_rate']=None
        for mn,p in P.items():
            if p is None:  # always 50/50 line-blind baseline: train-period hit rate per fmt
                p=r.groupby('fmt')[stat].transform(lambda s:0)*0+y.groupby(r.year).transform('mean').shift(0).values*0+y.groupby(r.fmt).transform('mean').values
            p=np.clip(np.asarray(p,float),1e-4,1-1e-4)
            t=pd.DataFrame({'fmt':r.fmt.values,'year':r.year.values,'y':y.values,'p':p,'intl':r.intl.values,'inn':r.inn.values,'g':r.g.values})
            rows.append(t.assign(stat=stat,kind=kind,line=lname,model=mn))
    return pd.concat(rows)
if __name__=='__main__':
    bat=pd.read_parquet('bat_f.parquet'); bowl=pd.read_parquet('bowl_f.parquet')
    res=[]
    for s in ['runs','balls','fours','sixes']:
        fc=[f'f_{x}' for x in ['runs','balls','fours','sixes']]+[f'med_{s}','f_pos']+[f'ven_{s}',f'opp_{s}']
        res.append(run(bat,s,fc,'bat')); print(s,flush=True)
    for s in ['wkts','conc']:
        fc=['f_wkts','f_conc','f_bb',f'med_{s}',f'ven_{s}',f'opp_{s}']
        res.append(run(bowl,s,fc,'bowl')); print(s,flush=True)
    pd.concat(res).to_parquet('preds_player.parquet')
