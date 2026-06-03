:- consult('parser_propositional.pl').
:- consult('pretty_print.pl').

:- dynamic counter/1.
counter(0).

fresh_var(V) :-
    retract(counter(N)),
    N1 is N + 1,
    assertz(counter(N1)),
    atom_concat('x', N1, V).

reset_counter :-
    retractall(counter(_)),
    assertz(counter(0)).

tseitin_formula(Input, Clauses) :-
    parse_propositional_formula(Input, AST),
    tseitin_transform(AST, Clauses).

tseitin_transform(AST, and(Clauses, Root)) :-
    reset_counter,
    tseitin(AST, Root, Clauses).

merge(true, X, X) :- !.
merge(X, true, X) :- !.
merge(X, Y, and(X, Y)).

tseitin(var(X), X, true) :- !.

% not: A <=> ~B
% (~A \/ ~B) /\ (A \/ B)
tseitin(not(Sub), A, Clauses) :-
    fresh_var(A),
    tseitin(Sub, B, SubClauses),
    merge(and(or(not(A), not(B)), or(A, B)), SubClauses, Clauses).

% and: A <=> B /\ C
% (~A \/ B) /\ (~A \/ C) /\ (A \/ ~B \/ ~C)
tseitin(and(L, R), A, Clauses) :-
    fresh_var(A),
    tseitin(L, B, LeftClauses),
    tseitin(R, C, RightClauses),
    merge(LeftClauses, RightClauses, LR),
    merge(and(or(not(A), B), and(or(not(A), C), or(A, not(B), not(C)))), LR, Clauses).

% or: A <=> B \/ C
% (A \/ ~B) /\ (A \/ ~C) /\ (~A \/ B \/ C)
tseitin(or(L, R), A, Clauses) :-
    fresh_var(A),
    tseitin(L, B, LeftClauses),
    tseitin(R, C, RightClauses),
    merge(LeftClauses, RightClauses, LR),
    merge(and(or(A, not(B)), and(or(A, not(C)), or(not(A), B, C))), LR, Clauses).

% imp: A <=> B => C  equal to  A <=> ~B \/ C
% (A \/ B) /\ (A \/ ~C) /\ (~A \/ ~B \/ C)
tseitin(imp(L, R), A, Clauses) :-
    fresh_var(A),
    tseitin(L, B, LeftClauses),
    tseitin(R, C, RightClauses),
    merge(LeftClauses, RightClauses, LR),
    merge(and(or(A, B), and(or(A, not(C)), or(not(A), not(B), C))), LR, Clauses).

% iff: A <=> (B <=> C)
% (~A \/ ~B \/ C) /\ (~A \/ B \/ ~C) /\ (A \/ ~B \/ ~C) /\ (A \/ B \/ C)
tseitin(iff(L, R), A, Clauses) :-
    fresh_var(A),
    tseitin(L, B, LeftClauses),
    tseitin(R, C, RightClauses),
    merge(LeftClauses, RightClauses, LR),
    merge(
        and(or(not(A), not(B), C),
        and(or(not(A), B, not(C)),
        and(or(A, not(B), not(C)),
        or(A, B, C)))),
        LR, Clauses).

tseitin_pretty_from_input(Input, Pretty) :-
    tseitin_formula(Input, Clauses),
    ast_to_symbols(Clauses, Pretty).

% structure for visualization tree
tseitin_annotated_tree(Input, Tree) :-
    parse_propositional_formula(Input, AST),
    reset_counter,
    annotate_tree(AST, Tree).

annotate_tree(var(X), leaf(X)) :- !.
annotate_tree(not(Sub), node1(A, not, SubNode)) :-
    fresh_var(A),
    annotate_tree(Sub, SubNode).
annotate_tree(and(L, R), node(A, and, LNode, RNode)) :-
    fresh_var(A),
    annotate_tree(L, LNode),
    annotate_tree(R, RNode).
annotate_tree(or(L, R), node(A, or, LNode, RNode)) :-
    fresh_var(A),
    annotate_tree(L, LNode),
    annotate_tree(R, RNode).
annotate_tree(imp(L, R), node(A, imp, LNode, RNode)) :-
    fresh_var(A),
    annotate_tree(L, LNode),
    annotate_tree(R, RNode).
annotate_tree(iff(L, R), node(A, iff, LNode, RNode)) :-
    fresh_var(A),
    annotate_tree(L, LNode),
    annotate_tree(R, RNode).


% Extra functionality for GUI:
% local clauses of selected operator node

tree_root_var(leaf(X), X) :- !.
tree_root_var(node1(A, _, _), A) :- !.
tree_root_var(node(A, _, _, _), A) :- !.

tree_find_operator_node(Node, Var, Node) :-
    Node = node1(Var, _, _),
    !.
tree_find_operator_node(Node, Var, Node) :-
    Node = node(Var, _, _, _),
    !.
tree_find_operator_node(node1(_, _, Child), Var, Node) :-
    tree_find_operator_node(Child, Var, Node),
    !.
tree_find_operator_node(node(_, _, Left, _), Var, Node) :-
    tree_find_operator_node(Left, Var, Node),
    !.
tree_find_operator_node(node(_, _, _, Right), Var, Node) :-
    tree_find_operator_node(Right, Var, Node),
    !.

node_local_clauses(node1(A, not, Sub), [
    or(not(A), not(B)),
    or(A, B)
]) :-
    tree_root_var(Sub, B),
    !.

node_local_clauses(node(A, and, Left, Right), [
    or(not(A), B),
    or(not(A), C),
    or(A, not(B), not(C))
]) :-
    tree_root_var(Left, B),
    tree_root_var(Right, C),
    !.

node_local_clauses(node(A, or, Left, Right), [
    or(A, not(B)),
    or(A, not(C)),
    or(not(A), B, C)
]) :-
    tree_root_var(Left, B),
    tree_root_var(Right, C),
    !.

node_local_clauses(node(A, imp, Left, Right), [
    or(A, B),
    or(A, not(C)),
    or(not(A), not(B), C)
]) :-
    tree_root_var(Left, B),
    tree_root_var(Right, C),
    !.

node_local_clauses(node(A, iff, Left, Right), [
    or(not(A), not(B), C),
    or(not(A), B, not(C)),
    or(A, not(B), not(C)),
    or(A, B, C)
]) :-
    tree_root_var(Left, B),
    tree_root_var(Right, C),
    !.

tree_node_local_clauses(Tree, Var, Clauses) :-
    tree_find_operator_node(Tree, Var, Node),
    node_local_clauses(Node, Clauses).

clauses_list_to_formula([], true) :- !.
clauses_list_to_formula([C], C) :- !.
clauses_list_to_formula([C | Cs], and(C, Rest)) :-
    clauses_list_to_formula(Cs, Rest).

tree_node_clause_formula(Tree, Var, Formula) :-
    tree_node_local_clauses(Tree, Var, Clauses),
    clauses_list_to_formula(Clauses, Formula).

tree_node_pretty_clause_formula(Tree, Var, Pretty) :-
    tree_node_clause_formula(Tree, Var, Formula),
    ast_to_symbols(Formula, Pretty).

node_equivalence_term(node1(A, not, Sub), iff(A, not(B))) :-
    tree_root_var(Sub, B),
    !.

node_equivalence_term(node(A, and, Left, Right), iff(A, and(B, C))) :-
    tree_root_var(Left, B),
    tree_root_var(Right, C),
    !.

node_equivalence_term(node(A, or, Left, Right), iff(A, or(B, C))) :-
    tree_root_var(Left, B),
    tree_root_var(Right, C),
    !.

node_equivalence_term(node(A, imp, Left, Right), iff(A, imp(B, C))) :-
    tree_root_var(Left, B),
    tree_root_var(Right, C),
    !.

node_equivalence_term(node(A, iff, Left, Right), iff(A, iff(B, C))) :-
    tree_root_var(Left, B),
    tree_root_var(Right, C),
    !.

tree_node_pretty_equivalence(Tree, Var, Pretty) :-
    tree_find_operator_node(Tree, Var, Node),
    node_equivalence_term(Node, Term),
    ast_to_symbols(Term, Pretty).

tseitin_node_pretty_info(Input, Var, EqPretty, ClauseFormulaPretty) :-
    tseitin_annotated_tree(Input, Tree),
    tree_node_pretty_equivalence(Tree, Var, EqPretty),
    tree_node_pretty_clause_formula(Tree, Var, ClauseFormulaPretty).