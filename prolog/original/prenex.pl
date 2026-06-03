:- consult('parser_predicate.pl').

:- dynamic prenex_var_counter/1.
prenex_var_counter(0).

reset_prenex_counter :-
    retractall(prenex_var_counter(_)),
    assertz(prenex_var_counter(0)).

fresh_bound_var(Old, New) :-
    retract(prenex_var_counter(N)),
    N1 is N + 1,
    assertz(prenex_var_counter(N1)),
    atomic_list_concat([Old, '_', N1], New).

prenex_normal_form(Input, Prenex) :-
    parse_predicate_formula(Input, AST),
    to_prenex_normal_form(AST, Prenex).

to_prenex_normal_form(AST, Prenex) :-
    eliminate_imp_iff(AST, NoImpIff),
    nnf(NoImpIff, NNF0),
    standardize_apart(NNF0, NNF),
    extract_prefix(NNF, Prefix, Matrix),
    build_prenex(Prefix, Matrix, Prenex).

% Optional helper to inspect intermediate forms
prenex_steps(Input, AST, NoImpIff, NNF, Prenex) :-
    parse_predicate_formula(Input, AST),
    eliminate_imp_iff(AST, NoImpIff),
    nnf(NoImpIff, NNF0),
    standardize_apart(NNF0, NNF),
    extract_prefix(NNF, Prefix, Matrix),
    build_prenex(Prefix, Matrix, Prenex).

% eliminate implication and equivalence

eliminate_imp_iff(pred(Name, Args), pred(Name, Args)) :- !.
eliminate_imp_iff(var(X), var(X)) :- !.

eliminate_imp_iff(not(F), not(F1)) :- !,
    eliminate_imp_iff(F, F1).

eliminate_imp_iff(and(A, B), and(A1, B1)) :- !,
    eliminate_imp_iff(A, A1),
    eliminate_imp_iff(B, B1).

eliminate_imp_iff(or(A, B), or(A1, B1)) :- !,
    eliminate_imp_iff(A, A1),
    eliminate_imp_iff(B, B1).

eliminate_imp_iff(imp(A, B), or(not(A1), B1)) :- !,
    eliminate_imp_iff(A, A1),
    eliminate_imp_iff(B, B1).

eliminate_imp_iff(iff(A, B), and(or(not(A1), B1), or(not(B1), A1))) :- !,
    eliminate_imp_iff(A, A1),
    eliminate_imp_iff(B, B1).

eliminate_imp_iff(forall(var(X), F), forall(var(X), F1)) :- !,
    eliminate_imp_iff(F, F1).

eliminate_imp_iff(exists(var(X), F), exists(var(X), F1)) :- !,
    eliminate_imp_iff(F, F1).


% negation normal form
nnf(pred(Name, Args), pred(Name, Args)) :- !.
nnf(var(X), var(X)) :- !.

nnf(not(F), NNF) :- !,
    nnf_neg(F, NNF).

nnf(and(A, B), and(A1, B1)) :- !,
    nnf(A, A1),
    nnf(B, B1).

nnf(or(A, B), or(A1, B1)) :- !,
    nnf(A, A1),
    nnf(B, B1).

nnf(forall(var(X), F), forall(var(X), F1)) :- !,
    nnf(F, F1).

nnf(exists(var(X), F), exists(var(X), F1)) :- !,
    nnf(F, F1).

nnf_neg(pred(Name, Args), not(pred(Name, Args))) :- !.
nnf_neg(var(X), not(var(X))) :- !.

nnf_neg(not(F), NNF) :- !,
    nnf(F, NNF).

nnf_neg(and(A, B), or(A1, B1)) :- !,
    nnf_neg(A, A1),
    nnf_neg(B, B1).

nnf_neg(or(A, B), and(A1, B1)) :- !,
    nnf_neg(A, A1),
    nnf_neg(B, B1).

nnf_neg(forall(var(X), F), exists(var(X), F1)) :- !,
    nnf_neg(F, F1).

nnf_neg(exists(var(X), F), forall(var(X), F1)) :- !,
    nnf_neg(F, F1).

% Safety fallback if imp/iff accidentally remained
nnf_neg(imp(A, B), NNF) :- !,
    eliminate_imp_iff(imp(A, B), F1),
    nnf_neg(F1, NNF).

nnf_neg(iff(A, B), NNF) :- !,
    eliminate_imp_iff(iff(A, B), F1),
    nnf_neg(F1, NNF).

% standardize bound variables apart
standardize_apart(Formula, Standardized) :-
    reset_prenex_counter,
    standardize_formula(Formula, [], Standardized).

standardize_formula(pred(Name, Args), Env, pred(Name, Args1)) :- !,
    standardize_terms(Args, Env, Args1).

standardize_formula(var(X), _, var(X)) :- !.

standardize_formula(not(F), Env, not(F1)) :- !,
    standardize_formula(F, Env, F1).

standardize_formula(and(A, B), Env, and(A1, B1)) :- !,
    standardize_formula(A, Env, A1),
    standardize_formula(B, Env, B1).

standardize_formula(or(A, B), Env, or(A1, B1)) :- !,
    standardize_formula(A, Env, A1),
    standardize_formula(B, Env, B1).

standardize_formula(forall(var(X), F), Env, forall(var(NewX), F1)) :- !,
    fresh_bound_var(X, NewX),
    standardize_formula(F, [X-NewX|Env], F1).

standardize_formula(exists(var(X), F), Env, exists(var(NewX), F1)) :- !,
    fresh_bound_var(X, NewX),
    standardize_formula(F, [X-NewX|Env], F1).

standardize_terms([], _, []).
standardize_terms([T|Ts], Env, [T1|Ts1]) :-
    standardize_term(T, Env, T1),
    standardize_terms(Ts, Env, Ts1).

standardize_term(var(X), Env, var(Y)) :-
    ( memberchk(X-Y, Env) -> true ; Y = X ),
    !.
standardize_term(const(C), _, const(C)) :- !.
standardize_term(func(Name, Args), Env, func(Name, Args1)) :- !,
    standardize_terms(Args, Env, Args1).

% pull quantifiers to the front
extract_prefix(forall(var(X), F), [q(forall, X)|Qs], Matrix) :- !,
    extract_prefix(F, Qs, Matrix).

extract_prefix(exists(var(X), F), [q(exists, X)|Qs], Matrix) :- !,
    extract_prefix(F, Qs, Matrix).

extract_prefix(and(A, B), Qs, and(MA, MB)) :- !,
    extract_prefix(A, QA, MA),
    extract_prefix(B, QB, MB),
    merge_prefixes(QA, QB, Qs).

extract_prefix(or(A, B), Qs, or(MA, MB)) :- !,
    extract_prefix(A, QA, MA),
    extract_prefix(B, QB, MB),
    merge_prefixes(QA, QB, Qs).

extract_prefix(F, [], F).

% Merge two independent quantifier prefixes.
% The order inside each prefix is preserved, so dependencies like forall-exists are not broken.
% But a prefix containing exists is moved earlier when it is safe.
merge_prefixes([], Qs, Qs) :- !.
merge_prefixes(Qs, [], Qs) :- !.
merge_prefixes(QA, QB, [Q|Qs]) :-
    exists_distance(QA, DA),
    exists_distance(QB, DB),
    (   DB < DA
    ->  QB = [Q|QBRest],
        merge_prefixes(QA, QBRest, Qs)
    ;   QA = [Q|QARest],
        merge_prefixes(QARest, QB, Qs)
    ).

% Distance to the first existential quantifier in a prefix.
% Smaller distance = this prefix should be pulled earlier.
exists_distance(Qs, D) :-
    exists_distance(Qs, 0, D).

exists_distance([], _, 1000000) :- !.
exists_distance([q(exists, _)|_], Acc, Acc) :- !.
exists_distance([_|Rest], Acc, D) :-
    Acc1 is Acc + 1,
    exists_distance(Rest, Acc1, D).

build_prenex([], Matrix, Matrix).
build_prenex([q(forall, X)|Qs], Matrix, forall(var(X), F)) :-
    build_prenex(Qs, Matrix, F).
build_prenex([q(exists, X)|Qs], Matrix, exists(var(X), F)) :-
    build_prenex(Qs, Matrix, F).