import pandas as pd, numpy as np
from feats import *
bat=pd.read_parquet('bat.parquet'); bowl=pd.read_parquet('bowl.parquet')
BS=['runs','balls','fours','sixes']; WS=['wkts','conc','bb']
bat=player_feats(bat,BS)
bat=ctx_feats(bat,BS,['venue','fmt','g'],'ven'); bat=ctx_feats(bat,BS,['opp','fmt','g'],'opp')
bowl=player_feats(bowl,WS)
bowl=ctx_feats(bowl,WS,['venue','fmt','g'],'ven'); bowl=ctx_feats(bowl,WS,['opp','fmt','g'],'opp')
bat.to_parquet('bat_f.parquet'); bowl.to_parquet('bowl_f.parquet'); print(bat.shape,bowl.shape)
