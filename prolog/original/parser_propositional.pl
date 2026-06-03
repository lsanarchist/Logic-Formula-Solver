parse(Tokens, AST) :-
    phrase(formula(AST), Tokens, []),
    !.
parse(Tokens, _) :-
    format("Parse error. Remaining tokens: ~w~n", [Tokens]),
    fail.

:- consult('tokenizer.pl').   
parse_propositional_formula(Input, AST) :-
    tokenize(Input, Tokens),
    parse(Tokens, AST).

%  DCG-rools

formula(AST) --> iff_expr(AST).

iff_expr(AST) -->
    imp_expr(Left),
    iff_rest(Left, AST).

iff_rest(Left, iff(Left, Right)) -->
    [iff], !,
    iff_expr(Right).
iff_rest(AST, AST) --> [].

imp_expr(AST) -->
    or_expr(Left),
    imp_rest(Left, AST).

imp_rest(Left, imp(Left, Right)) -->
    [imp], !,
    imp_expr(Right).
imp_rest(AST, AST) --> [].

or_expr(AST) -->
    and_expr(Left),
    or_rest(Left, AST).

or_rest(Acc, AST) -->
    [or], !,
    and_expr(Right),
    or_rest(or(Acc, Right), AST).
or_rest(AST, AST) --> [].

and_expr(AST) -->
    unary(Left),
    and_rest(Left, AST).

and_rest(Acc, AST) -->
    [and], !,
    unary(Right),
    and_rest(and(Acc, Right), AST).
and_rest(AST, AST) --> [].

unary(not(X)) -->
    [not], !,
    unary(X).
unary(X) -->
    primary(X).

%% primary = var(X) | '(' formula ')'
primary(var(X)) -->
    [var(X)].
primary(true) -->
    [true].
primary(false) -->
    [false].
primary(AST) -->
    [lparen],
    formula(AST),
    [rparen].
