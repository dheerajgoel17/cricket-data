"""One side, two names: a team the books (or another feed) name differently from the schedule is one team key.

Keys are a team name lower-cased with everything but letters and digits removed. Kept equal to ``SAME_SIDE`` in site/packages/engine/util.js (tests/value_bets/test_vb_archive.py).
A key stands for one side only when the other side and the start also agree, so a short name like "central" never joins two different matches.
"""

SAME_SIDE = {"aucklandaces": "auckland", "canterburykings": "canterbury", "wellingtonfirebirds": "wellington", "otagovolts": "otago", "northerndistricts": "northernbrave", "boland": "rocks",
             "southwesterndistricts": "gardenroutebadgers", "easterns": "easternstorm", "centraldistricts": "centralstags", "central": "centralstags", "eagles": "mashonalandeagles",
             "tuskers": "matabelelandtuskers"}
