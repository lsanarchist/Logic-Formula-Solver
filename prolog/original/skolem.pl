:- encoding(utf8).
:- consult('prenex.pl').

:- dynamic skolem_sym_counter/1.

reset_skolem_counter :-
    retractall(skolem_sym_counter(_)),
    assertz(skolem_sym_counter(0)).

fresh_skolem_name(Sk) :-
    retract(skolem_sym_counter(N)),
    N1 is N + 1,
    assertz(skolem_sym_counter(N1)),
    atomic_list_concat([sk, '_', N1], Sk).

skolem_normal_form(Input, SkolemAst) :-
    prenex_normal_form(Input, Prenex),
    reset_skolem_counter,
    skolem_walk(Prenex, [], SkolemAst).

skolem_ast_from_input(Input, SkolemAst) :-
    skolem_normal_form(Input, SkolemAst).

skolem_pretty_from_input(Input, Pretty) :-
    skolem_normal_form(Input, Ast),
    skolem_ast_to_pretty(Ast, Pretty).

% Optional: inspect prenex AST and Skolem AST (both structured terms)
skolem_steps(Input, PrenexAst, SkolemAst) :-
    prenex_normal_form(Input, PrenexAst),
    reset_skolem_counter,
    skolem_walk(PrenexAst, [], SkolemAst).

skolem_steps_pretty(Input, PrenexPretty, SkolemPretty) :-
    prenex_normal_form(Input, PrenexAst),
    skolem_ast_to_pretty(PrenexAst, PrenexPretty),
    reset_skolem_counter,
    skolem_walk(PrenexAst, [], SkolemAst),
    skolem_ast_to_pretty(SkolemAst, SkolemPretty).

% Univs = outer-to-inner list of universal binders (atoms) for Skolem arg order
skolem_walk(forall(var(X), F), Univs, forall(var(X), Out)) :- !,
    append(Univs, [X], Univs1),
    skolem_walk(F, Univs1, Out).

skolem_walk(exists(var(X), F), Univs, Out) :- !,
    fresh_skolem_name(SkName),
    skolem_head_term(Univs, SkName, SkTerm),
    substitute_formula(F, X, SkTerm, F1),
    skolem_walk(F1, Univs, Out).

skolem_walk(Matrix, _, Matrix) :-
    quantifier_free(Matrix).

skolem_head_term([], SkName, const(SkName)).
skolem_head_term(Univs, SkName, func(SkName, Args)) :-
    Univs \= [],
    maplist(atom_to_var_term, Univs, Args).

atom_to_var_term(X, var(X)).

quantifier_free(pred(_, _)).
quantifier_free(var(_)).
quantifier_free(not(F)) :-
    quantifier_free(F).
quantifier_free(and(A, B)) :-
    quantifier_free(A),
    quantifier_free(B).
quantifier_free(or(A, B)) :-
    quantifier_free(A),
    quantifier_free(B).
quantifier_free(imp(A, B)) :-
    quantifier_free(A),
    quantifier_free(B).
quantifier_free(iff(A, B)) :-
    quantifier_free(A),
    quantifier_free(B).

% ------------- Substitution (variable atom -> Skolem term) ----------

substitute_formula(pred(Name, Args), Var, Rep, pred(Name, Args1)) :- !,
    maplist(subst_term(Var, Rep), Args, Args1).

substitute_formula(var(V), Var, Rep, Rep) :-
    V == Var,
    !.

substitute_formula(var(V), Var, _, var(V)) :-
    V \== Var,
    !.

substitute_formula(not(F), Var, Rep, not(F1)) :- !,
    substitute_formula(F, Var, Rep, F1).

substitute_formula(and(A, B), Var, Rep, and(A1, B1)) :- !,
    substitute_formula(A, Var, Rep, A1),
    substitute_formula(B, Var, Rep, B1).

substitute_formula(or(A, B), Var, Rep, or(A1, B1)) :- !,
    substitute_formula(A, Var, Rep, A1),
    substitute_formula(B, Var, Rep, B1).

substitute_formula(imp(A, B), Var, Rep, imp(A1, B1)) :- !,
    substitute_formula(A, Var, Rep, A1),
    substitute_formula(B, Var, Rep, B1).

substitute_formula(iff(A, B), Var, Rep, iff(A1, B1)) :- !,
    substitute_formula(A, Var, Rep, A1),
    substitute_formula(B, Var, Rep, B1).

substitute_formula(forall(var(X), F), Var, Rep, forall(var(X), F1)) :- !,
    ( X == Var ->
        F1 = F
    ;
        substitute_formula(F, Var, Rep, F1)
    ).

substitute_formula(exists(var(X), F), Var, Rep, exists(var(X), F1)) :- !,
    ( X == Var ->
        F1 = F
    ;
        substitute_formula(F, Var, Rep, F1)
    ).

subst_term(Var, Rep, T, T1) :-
    substitute_term(T, Var, Rep, T1).

substitute_term(var(V), Var, Rep, Rep) :-
    V == Var,
    !.

substitute_term(var(V), Var, _, var(V)) :-
    V \== Var,
    !.

substitute_term(const(C), _, _, const(C)) :- !.

substitute_term(func(Name, Args), Var, Rep, func(Name, Args1)) :- !,
    maplist(subst_term(Var, Rep), Args, Args1).

% ------------- Pretty-print (predicate AST, symbols like pretty_print) --

quantifier_wrap_operand(forall(_, _)).
quantifier_wrap_operand(exists(_, _)).
quantifier_wrap_operand(and(_, _)).
quantifier_wrap_operand(or(_, _)).
quantifier_wrap_operand(not(_)).
quantifier_wrap_operand(imp(_, _)).
quantifier_wrap_operand(iff(_, _)).

skolem_ast_to_pretty(exists(var(X), F), Out) :- !,
    skolem_ast_to_pretty(F, Inner),
    ( quantifier_wrap_operand(F) ->
        format(atom(Out), '∃ ~w. (~w)', [X, Inner])
    ;
        format(atom(Out), '∃ ~w. ~w', [X, Inner])
    ).

skolem_ast_to_pretty(forall(var(X), F), Out) :- !,
    skolem_ast_to_pretty(F, Inner),
    ( quantifier_wrap_operand(F) ->
        format(atom(Out), '∀ ~w. (~w)', [X, Inner])
    ;
        format(atom(Out), '∀ ~w. ~w', [X, Inner])
    ).

skolem_ast_to_pretty(pred(Name, Args), Out) :- !,
    ( Args = [] ->
        Out = Name
    ;
        maplist(skolem_term_to_pretty, Args, Parts),
        atomic_list_concat(Parts, ', ', ArgStr),
        format(atom(Out), '~w(~w)', [Name, ArgStr])
    ).

skolem_ast_to_pretty(var(X), X).

skolem_ast_to_pretty(not(A), Out) :- !,
    skolem_ast_to_pretty(A, PA),
    ( A = var(_) ->
        format(atom(Out), '~w~w', ['~', PA])
    ;
        format(atom(Out), '~w(~w)', ['~', PA])
    ).

skolem_ast_to_pretty(and(A, B), Out) :- !,
    skolem_ast_to_pretty(A, SA),
    skolem_ast_to_pretty(B, SB),
    format(atom(Out), '(~w & ~w)', [SA, SB]).

skolem_ast_to_pretty(or(A, B), Out) :- !,
    skolem_ast_to_pretty(A, SA),
    skolem_ast_to_pretty(B, SB),
    format(atom(Out), '(~w | ~w)', [SA, SB]).

skolem_ast_to_pretty(imp(A, B), Out) :- !,
    skolem_ast_to_pretty(A, SA),
    skolem_ast_to_pretty(B, SB),
    format(atom(Out), '(~w -> ~w)', [SA, SB]).

skolem_ast_to_pretty(iff(A, B), Out) :- !,
    skolem_ast_to_pretty(A, SA),
    skolem_ast_to_pretty(B, SB),
    format(atom(Out), '(~w <-> ~w)', [SA, SB]).

skolem_term_to_pretty(var(X), X).
skolem_term_to_pretty(const(C), C).
skolem_term_to_pretty(func(F, Args), Out) :-
    maplist(skolem_term_to_pretty, Args, Parts),
    atomic_list_concat(Parts, ', ', ArgStr),
    format(atom(Out), '~w(~w)', [F, ArgStr]).
