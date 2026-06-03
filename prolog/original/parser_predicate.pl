parse_pred(Tokens, AST) :-
    phrase(formula_pred(AST, []), Tokens, []),
    !.
parse_pred(Tokens, _) :-
    format("Parse error. Remaining tokens: ~w~n", [Tokens]),
    fail.

:- consult('tokenizer.pl').
parse_predicate_formula(Input, AST) :-
    tokenize(Input, Tokens),
    parse_pred(Tokens, AST).

%  DCG-rools

formula_pred(AST, BoundVars) --> iff_expr_pred(AST, BoundVars).

iff_expr_pred(AST, BoundVars) -->
    imp_expr_pred(Left, BoundVars),
    iff_rest_pred(Left, AST, BoundVars).

iff_rest_pred(Left, iff(Left, Right), BoundVars) -->
    [iff], !,
    iff_expr_pred(Right, BoundVars).
iff_rest_pred(AST, AST, _) --> [].

imp_expr_pred(AST, BoundVars) -->
    or_expr_pred(Left, BoundVars),
    imp_rest_pred(Left, AST, BoundVars).

imp_rest_pred(Left, imp(Left, Right), BoundVars) -->
    [imp], !,
    imp_expr_pred(Right, BoundVars).
imp_rest_pred(AST, AST, _) --> [].

or_expr_pred(AST, BoundVars) -->
    and_expr_pred(Left, BoundVars),
    or_rest_pred(Left, AST, BoundVars).

or_rest_pred(Acc, AST, BoundVars) -->
    [or], !,
    and_expr_pred(Right, BoundVars),
    or_rest_pred(or(Acc, Right), AST, BoundVars).
or_rest_pred(AST, AST, _) --> [].

and_expr_pred(AST, BoundVars) -->
    unary_pred(Left, BoundVars),
    and_rest_pred(Left, AST, BoundVars).

and_rest_pred(Acc, AST, BoundVars) -->
    [and], !,
    unary_pred(Right, BoundVars),
    and_rest_pred(and(Acc, Right), AST, BoundVars).
and_rest_pred(AST, AST, _) --> [].

unary_pred(not(X), BoundVars) -->
    [not], !,
    unary_pred(X, BoundVars).

unary_pred(forall(var(X), Formula), BoundVars) -->
    [forall], !,
    quantified_var(X),
    [dot],
    unary_pred(Formula, [X|BoundVars]).

unary_pred(exists(var(X), Formula), BoundVars) -->
    [exists], !,
    quantified_var(X),
    [dot],
    unary_pred(Formula, [X|BoundVars]).

unary_pred(X, BoundVars) -->
    primary(X, BoundVars).

quantified_var(X) -->
    [var(X)].

%% primary = atomic_formula | '(' formula ')'
primary(AST, BoundVars) -->
    [lparen],
    formula_pred(AST, BoundVars),
    [rparen].

primary(AST, BoundVars) -->
    atomic_formula(AST, BoundVars).

%% atomic formulas
%% bare propositional-style atom is preserved as var(Name)
atomic_formula(pred(Name, Args), BoundVars) -->
    [var(Name)],
    [lparen],
    term_list(Args, BoundVars),
    [rparen].

atomic_formula(var(Name), _) -->
    [var(Name)].

%% terms
term_list([Term|Terms], BoundVars) -->
    term(Term, BoundVars),
    term_list_rest(Terms, BoundVars).

term_list_rest([Term|Terms], BoundVars) -->
    [comma], !,
    term(Term, BoundVars),
    term_list_rest(Terms, BoundVars).
term_list_rest([], _) --> [].

term(Term, BoundVars) -->
    [var(Name)],
    term_rest(Name, Term, BoundVars).

term_rest(Name, func(Name, Args), BoundVars) -->
    [lparen],
    term_list(Args, BoundVars),
    [rparen].

term_rest(Name, Term, BoundVars) -->
    { classify_term(Name, BoundVars, Term) }.

%% Bound variables are always variables.
%% Free variables are recognized by a simple naming convention:
%% x, y, z, u, v, w and their indexed/extended forms (x1, y_2, ...)
%% everything else defaults to const(Name)
classify_term(Name, BoundVars, var(Name)) :-
    memberchk(Name, BoundVars), !.
classify_term(Name, _, var(Name)) :-
    looks_like_variable(Name), !.
classify_term(Name, _, const(Name)).

looks_like_variable(Name) :-
    atom_chars(Name, [First|Rest]),
    memberchk(First, ['x','y','z','u','v','w','X','Y','Z','U','V','W','_']),
    variable_tail(Rest).

variable_tail([]).
variable_tail([C|Rest]) :-
    (char_type(C, alnum) ; C = '_'),
    variable_tail(Rest).