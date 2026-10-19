import pandas as pd, numpy as np
HL=8  # innings half-life
def player_feats(df, stats, key='player'):
    df=df.sort_values(['date','mid','inn']).reset_index(drop=True)
    df['n_prev']=df.groupby([key,'fmt','g']).cumcount()
    for s in stats:
        gs=df.groupby([key,'fmt','g'])[s]
        df[f'f_{s}']=gs.transform(lambda x:x.shift().ewm(halflife=HL,min_periods=1).mean())
        df[f'med_{s}']=gs.transform(lambda x:x.shift().rolling(10,min_periods=3).median())
        # buggy legacy: mixes all formats
        df[f'mix_{s}']=df.groupby([key,'g'])[s].transform(lambda x:x.shift().ewm(halflife=HL,min_periods=1).mean())
    if 'pos' in df:
        df['f_pos']=df.groupby([key,'fmt','g'])['pos'].transform(lambda x:x.shift().ewm(halflife=4,min_periods=1).mean())
    # Tests: features frozen at match start (no in-match leakage from 1st innings)
    cols=[c for c in df.columns if c.startswith(('f_','med_','mix_'))]+['n_prev']
    df[cols]=df.groupby([key,'mid'])[cols].transform('first')
    return df
def ctx_feats(df, stats, by, name):
    m=df.groupby(['mid','date']+by)[stats].mean().reset_index().sort_values('date')
    for s in stats:
        m[f'{name}_{s}']=m.groupby(by)[s].transform(lambda x:x.shift().ewm(halflife=15,min_periods=1).mean())
    return df.merge(m[['mid']+by+[f'{name}_{s}' for s in stats]],on=['mid']+by,how='left')
