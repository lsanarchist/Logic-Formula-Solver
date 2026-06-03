% ---- Pretty print AST using symbols ----
% Main entry point
ast_to_symbols(Ast, Out) :-
    !,
    ast_to_symbols_context(Ast, none, Out).

% Variables / atoms
ast_to_symbols_context(var(X), _, X) :- !.

ast_to_symbols_context(X, _, X) :-
    atom(X),
    X \= true,
    !.

% Constants
ast_to_symbols_context(true, _, 'true') :- !.

% Negation
ast_to_symbols_context(not(var(X)), _, Out) :-
    !,
    format(atom(Out), '~w~w', ['~', X]).

ast_to_symbols_context(not(A), _, Out) :-
    !,
    ast_to_symbols_context(A, none, SA),
    format(atom(Out), '~w~w~w', ['~(', SA, ')']).

% Implication / equivalence
ast_to_symbols_context(imp(A, B), _, Out) :-
    !,
    ast_to_symbols_context(A, none, SA),
    ast_to_symbols_context(B, none, SB),
    format(atom(Out), '(~w -> ~w)', [SA, SB]).

ast_to_symbols_context(iff(A, B), _, Out) :-
    !,
    ast_to_symbols_context(A, none, SA),
    ast_to_symbols_context(B, none, SB),
    format(atom(Out), '(~w <-> ~w)', [SA, SB]).

% AND with arbitrary arity
ast_to_symbols_context(Expr, _, Out) :-
    compound(Expr),
    Expr =.. [and | _],
    !,
    flatten_and(Expr, Operands),
    maplist(expr_to_string_and, Operands, Strings),
    atomic_list_concat(Strings, ' & ', Out).

% OR with arbitrary arity
ast_to_symbols_context(Expr, _, Out) :-
    compound(Expr),
    Expr =.. [or | _],
    !,
    flatten_or(Expr, Operands),
    maplist(expr_to_string_or, Operands, Strings),
    atomic_list_concat(Strings, ' | ', Out).

% Helper: flatten nested ANDs into a list
flatten_and(Expr, Result) :-
    compound(Expr),
    Expr =.. [and | Args],
    !,
    maplist(flatten_and, Args, Nested),
    append_all(Nested, Result).
flatten_and(X, [X]).

% Helper: flatten nested ORs into a list
flatten_or(Expr, Result) :-
    compound(Expr),
    Expr =.. [or | Args],
    !,
    maplist(flatten_or, Args, Nested),
    append_all(Nested, Result).
flatten_or(X, [X]).

append_all(Lists, Result) :-
    foldl(append, Lists, [], Result).

% Convert expression to string in AND context
% OR inside AND needs parens
expr_to_string_and(Expr, Out) :-
    compound(Expr),
    Expr =.. [or | _],
    !,
    ast_to_symbols_context(Expr, and_context, Temp),
    format(atom(Out), '(~w)', [Temp]).
expr_to_string_and(Expr, Out) :-
    ast_to_symbols_context(Expr, and_context, Out).

% Convert expression to string in OR context
% AND inside OR needs parens
expr_to_string_or(Expr, Out) :-
    compound(Expr),
    Expr =.. [and | _],
    !,
    ast_to_symbols_context(Expr, or_context, Temp),
    format(atom(Out), '(~w)', [Temp]).
expr_to_string_or(Expr, Out) :-
    ast_to_symbols_context(Expr, or_context, Out
    ).
