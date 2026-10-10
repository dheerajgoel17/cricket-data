"""Ask cricket questions in plain English and answer them from the dataset.

* ``db``     builds a fast, indexed SQLite copy of the data (rebuilt only when the data changes);
* ``tools``  name matching ("Cheapuk" -> Chepauk) and a safe read-only SQL runner;
* ``bot``    a Claude-powered assistant that uses those two tools to answer;
* ``server`` a tiny HTTP endpoint so any chat UI can plug in.
"""
