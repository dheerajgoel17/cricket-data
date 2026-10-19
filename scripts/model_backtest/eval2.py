import pandas as pd, numpy as np
exec(open('evalr.py').read().split("R=[]")[0])  # loads P, cal, writes calibration.csv
BE=1/1.9; MARG=[0,.02,.04,.06,.08,.10]
F=P[P.line=='fair_form']
def bets(t,side,mg):
    s=t[t.p>BE+mg] if side=='over' else t[(1-t.p)>BE+mg]
    w=s.y if side=='over' else 1-s.y; pw=s.p if side=='over' else 1-s.p
    return s,w.values,pw.values
def stats(w): n=len(w); return n,(w.sum()*0.9-(n-w.sum()))/n if n else np.nan
def kelly(w,pw,frac=.25,cap=.02):
    f=np.clip(frac*(pw*1.9-1)/0.9,0,cap); bank=1.0
    for fi,wi in zip(f,w): bank*=1+fi*(0.9 if wi else -1)
    return bank-1
R=[]
for k,t in F[F.model!='form_nb'].groupby(['stat','fmt','model']):
    for side in ('over','under'):
        for mg in MARG:
            row=list(k)+[side,mg]
            for per,tt in (('val',t[t.year<=2023]),('test',t[t.year>=2024])):
                s,w,pw=bets(tt.sort_values('year'),side,mg); n,r=stats(w); row+= [n,r]
                if per=='test': row.append(kelly(w,pw))
            R.append(row)
R=pd.DataFrame(R,columns=['stat','fmt','model','side','margin','val_n','val_roi','test_n','test_roi','test_kelly_ret'])
R.to_csv('roi_fair_grid.csv',index=False)
sel=R[R.val_n>=100].sort_values('val_roi',ascending=False).groupby(['stat','fmt']).head(1).sort_values(['stat','fmt'])
sel.to_csv('selected_fair.csv',index=False)
pd.set_option('display.width',250); pd.set_option('display.max_rows',500)
print(sel.round(3).to_string(index=False))
# calibration on the fair line, all models
c=C[C.line=='fair_form'].pivot_table(index=['stat','fmt'],columns='model',values='logloss')
print(c.round(4).to_string())
cb=C[C.line=='fair_form'].pivot_table(index=['stat','fmt'],columns='model',values='brier'); cb.round(4).to_csv('brier_fair.csv')
ce=C[C.line=='fair_form'].pivot_table(index=['stat','fmt'],columns='model',values='ece'); ce.round(4).to_csv('ece_fair.csv'); c.round(4).to_csv('logloss_fair.csv')
# situational splits for selected strategies (test period)
S=[]
for _,r in sel.iterrows():
    t=F[(F.stat==r.stat)&(F.fmt==r.fmt)&(F.model==r.model)&(F.year>=2024)]
    for col in ('intl','inn','g'):
        for v,tt in t.groupby(col):
            s,w,pw=bets(tt,r.side,r.margin); n,ro=stats(w)
            if n>=30: S.append((r.stat,r.fmt,r.model,r.side,r.margin,col,v,n,ro))
S=pd.DataFrame(S,columns=['stat','fmt','model','side','margin','split','value','n','roi']); S.to_csv('situations.csv',index=False)
print(S.round(3).to_string(index=False))
