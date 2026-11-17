from engine.threads import thread_budget


def test_small_computers_use_every_core():
    assert [thread_budget(n) for n in (1, 2, 4)] == [1, 2, 4]


def test_bigger_computers_keep_one_core_free_and_cap_at_eight():
    assert [thread_budget(n) for n in (6, 8, 16, 64)] == [5, 7, 8, 8]
