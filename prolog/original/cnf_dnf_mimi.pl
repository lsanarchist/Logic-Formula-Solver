:- consult('parser_propositional.pl').
:- consult('pretty_print.pl').

% ------------- CNF --------------
% Mimi

%result as = CNF AST
cnf_from_input(Input, Cnf) :-
    parse_propositional_formula(Input, Ast),
    to_cnf(Ast, Cnf).

%result as = A & B & (C | D)..
cnf_pretty_from_input(Input, Pretty) :-
    parse_propositional_formula(Input, Ast),
    to_cnf(Ast, Cnf),
    ast_to_symbols(Cnf, Pretty).

to_cnf(Ast, Cnf) :-
    eliminate_arrows(Ast, S1),
    to_nnf(S1, S2),
    distribute_or_over_and(S2, Cnf).    

% ------------- DNF --------------
%result as = DNF AST
dnf_from_input(Input, Dnf) :-
    parse_propositional_formula(Input, Ast),
    to_dnf(Ast, Dnf).

%result as = A | B | (C & D)..
dnf_pretty_from_input(Input, Pretty) :-
    parse_propositional_formula(Input, Ast),
    to_dnf(Ast, Dnf),
    ast_to_symbols(Dnf, Pretty).


% --- CNF to DNF: input = A .... CNF(not(A)) = C ... NNF(not(C)) = DNF(A)
to_dnf(Ast, Dnf) :-
    to_cnf(not(Ast), CnfNotAst),
    to_nnf(not(CnfNotAst), Dnf).



% ---- Eliminate implications and biconditionals ----
% A ---> A
eliminate_arrows(var(X), var(X)).

% constants
eliminate_arrows(true, true).
eliminate_arrows(false, false).

% ~A ---> ~A
eliminate_arrows(not(A), not(NA)) :-
    eliminate_arrows(A, NA).

% A and B ---> A and B
eliminate_arrows(and(A, B), and(NA, NB)) :-
    eliminate_arrows(A, NA),
    eliminate_arrows(B, NB).

% A or B ---> A or B
eliminate_arrows(or(A, B), or(NA, NB)) :-
    eliminate_arrows(A, NA),
    eliminate_arrows(B, NB).

% A -> B ---> ~A or B
eliminate_arrows(imp(A, B), or(not(NA), NB)) :-
    eliminate_arrows(A, NA),
    eliminate_arrows(B, NB).

% A <-> B ---> (~A or B) and (~B or A)
eliminate_arrows(iff(A, B), and(or(not(NA), NB), or(not(NB), NA))) :-
    eliminate_arrows(A, NA),
    eliminate_arrows(B, NB).

% ---- Convert to NNF ----
% A ---> A
to_nnf(var(X), var(X)).

% constants
to_nnf(true, true).
to_nnf(false, false).
to_nnf(not(true), false).
to_nnf(not(false), true).

% ~A ---> ~A
to_nnf(not(var(X)), not(var(X))).

% ~(~A) ---> A
to_nnf(not(not(A)), NNA) :-
    to_nnf(A, NNA).

% ~(A and B) ---> ~A or ~B
to_nnf(not(and(A, B)), or(NA, NB)) :-
    to_nnf(not(A), NA),
    to_nnf(not(B), NB).

% ~(A or B) ---> ~A and ~B
to_nnf(not(or(A, B)), and(NA, NB)) :-
    to_nnf(not(A), NA),
    to_nnf(not(B), NB).

% A and B ---> A and B
to_nnf(and(A, B), and(NA, NB)) :-
    to_nnf(A, NA),
    to_nnf(B, NB).

% A or B ---> A or B
to_nnf(or(A, B), or(NA, NB)) :-
    to_nnf(A, NA),
    to_nnf(B, NB).

% ---- Distribute OR over AND ----
% Literal stays unchanged
distribute_or_over_and(var(X), var(X)).

% Constants stay unchanged
distribute_or_over_and(true, true).
distribute_or_over_and(false, false).

% Negated literal stays unchanged
distribute_or_over_and(not(var(X)), not(var(X))).

% Recurse into both branches of conjunction
distribute_or_over_and(and(A, B), and(DA, DB)) :-
    distribute_or_over_and(A, DA),
    distribute_or_over_and(B, DB).

% Recurse into both branches of disjunction, then distribute
distribute_or_over_and(or(A, B), Out) :-
    distribute_or_over_and(A, DA),
    distribute_or_over_and(B, DB),
    distribute_or(DA, DB, Out).

% (A and C) or B ---> (A or B) and (C or B)
distribute_or(and(A, C), B, and(X, Y)) :-
    !,
    distribute_or(A, B, X),
    distribute_or(C, B, Y).

% A or (B and C) ---> (A or B) and (A or C)
distribute_or(A, and(B, C), and(X, Y)) :-
    !,
    distribute_or(A, B, X),
    distribute_or(A, C, Y).

% If no distribution pattern matches, keep disjunction
distribute_or(true, _, true) :- !.
distribute_or(_, true, true) :- !.
distribute_or(false, B, B) :- !.
distribute_or(A, false, A) :- !.
distribute_or(A, B, or(A, B)).
