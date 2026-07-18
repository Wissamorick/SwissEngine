from random import randint

import networkx as nx


def naive_max_matching(A) -> list[tuple[int, int]]:
    # Since the graph is almost complete, we should be able to find a path quite fast.
    # The first vertex should be adjacent to the 2nd, then we pick randomly a 3rd that should be adjacent to the 4th.
    # If it fails we just go back

    S = []
    attempts = 0
    failures = 0
    n = len(A)
    to_pair = set([i for i in range(n)])

    while len(to_pair) > 1 and attempts <= n * n:

        attempts += 1

        i = randint(0, len(to_pair) - 1)
        i = list(to_pair)[i]

        possible_opponents = []

        for j in range(n):
            if A[i][j] == 1 and j in to_pair:
                possible_opponents.append(j)

        if len(possible_opponents) != 0:
            j = randint(0, len(possible_opponents) - 1)
            j = possible_opponents[j]
            S.append((i, j))
            to_pair.remove(i)
            to_pair.remove(j)

        else:
            failures += 1
            for k in range(min(len(S), failures)):
                a = S.pop()
                to_pair.add(a[0])
                to_pair.add(a[1])
            if failures == n - 1:
                failures = 0

    return S


def MWM(G) -> list[tuple[int, int]]:
    """
    Finds pairings via Maximum Weight Matching (Fürlich, Cseh, Lenzner, 2021)

    Input :
    Graph G corresponding to the state of the tournament : each vertex is a player, and each edge a possibility of pairing with a certain weight
    Output : list of pairs
    """
    return sorted(nx.max_weight_matching(G, True))
