import numpy as np


def Sonneborn_Berger(M) -> list[float]:
    """
    Computes Sonneborn-Berger (SB) Tiebreaker for each player

    Input :
    M (np.ndarray(np.ndarray)) : matrix of result (M[i][j] is the result of i against j, = 0 if they haven't played)

    Output :
    L (list[float]) : list of SB values in the order of players
    """

    n = len(M)
    L = [0 for i in range(n)]

    for i in range(n):
        for j in range(n):
            score_of_opponent = np.sum(M[j])
            L[i] += M[i][j] * score_of_opponent

    return L


def Bucholz(M, cut=0) -> list[float]:
    """
    Computes Bucholz Cut (Regular Bucholz by default) Tiebreaker for each player

    Input :
    M (np.ndarray(np.ndarray)) : matrix of result (M[i][j] is the result of i against j, = 0 if they haven't played)

    Output :
    L (list[float]) : list of Bucholz Cut values in the order of players
    """

    n = len(M)
    L = [0 for i in range(n)]

    opponents_points = []
    for i in range(n):
        for j in range(n):
            # Compute standard Bucholz
            if M[i][j] + M[j][i] != 0:  # If i and j played each other
                score_of_opponent = np.sum(M[j])
                opponents_points.append(score_of_opponent)
                L[i] += score_of_opponent

        # Determine the scores we need to substract from the total to get the Bucholz Cut
        opponents_points.sort()
        minimums = np.sum(opponents_points[:cut])

        L[i] -= minimums

    return L
