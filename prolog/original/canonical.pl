:- consult('cnf_dnf_mimi.pl').
:- discontiguous canonical_dnf_from_input/2.
:- discontiguous canonical_dnf_pretty_from_input/2.

% ============================================
% CANONICAL CNF AND DNF IMPLEMENTATION
% ============================================
% Canonical forms ensure:
% - Every variable appears in each clause (CNF) or term (DNF)
% - No tautological clauses (A | ~A doesn't appear) 
% - No contradictory terms (A & ~A doesn't appear)
% - Literals within clauses/terms are sorted
% - Clauses/terms are sorted lexicographically
% ============================================

% ========== MAIN ENTRY POINTS ==========

% Canonical CNF from input
canonical_cnf_from_input(Input, CanonicalCnf) :-
    parse_propositional_formula(Input, Ast),
    to_cnf(Ast, Cnf),
    extract_all_variables(Ast, AllVars),
    canonicalize_cnf(Cnf, AllVars, CanonicalCnf).

% Pretty printed canonical CNF
canonical_cnf_pretty_from_input(Input, Pretty) :-
    canonical_cnf_from_input(Input, CanonicalCnf),
    ast_to_symbols(CanonicalCnf, Pretty).

% Canonical DNF from input
canonical_dnf_from_input(Input, CanonicalDnf) :-
    parse_propositional_formula(Input, Ast),
    to_dnf(Ast, Dnf),
    extract_all_variables(Ast, AllVars),
    canonicalize_dnf(Dnf, AllVars, CanonicalDnf).

% Pretty printed canonical DNF
canonical_dnf_pretty_from_input(Input, Pretty) :-
    canonical_dnf_from_input(Input, CanonicalDnf),
    ast_to_symbols(CanonicalDnf, Pretty).

% ========== VARIABLE EXTRACTION ==========

% Extract all variables from a formula (sorted and unique)
extract_all_variables(Ast, AllVars) :-
    extract_vars_helper(Ast, VarSet),
    sort(VarSet, AllVars).

extract_vars_helper(var(X), [var(X)]) :- !.
extract_vars_helper(not(A), Vars) :- !,
    extract_vars_helper(A, Vars).
extract_vars_helper(and(A, B), Vars) :- !,
    extract_vars_helper(A, VA),
    extract_vars_helper(B, VB),
    append(VA, VB, Vars).
extract_vars_helper(or(A, B), Vars) :- !,
    extract_vars_helper(A, VA),
    extract_vars_helper(B, VB),
    append(VA, VB, Vars).
extract_vars_helper(imp(A, B), Vars) :- !,
    extract_vars_helper(A, VA),
    extract_vars_helper(B, VB),
    append(VA, VB, Vars).
extract_vars_helper(iff(A, B), Vars) :- !,
    extract_vars_helper(A, VA),
    extract_vars_helper(B, VB),
    append(VA, VB, Vars).
extract_vars_helper(_, []).

% ========== VARIABLE ANALYSIS ==========

% Extract variables from a list of literals
extract_variables_from_literals([], []).
extract_variables_from_literals([var(V) | Rest], [var(V) | RV]) :- !,
    extract_variables_from_literals(Rest, RV).
extract_variables_from_literals([not(var(V)) | Rest], [var(V) | RV]) :- !,
    extract_variables_from_literals(Rest, RV).
extract_variables_from_literals([_ | Rest], RV) :-
    extract_variables_from_literals(Rest, RV).

% Find variables in AllVars that are missing from ClauseVars
find_missing_variables([], _, []).
find_missing_variables([V | Rest], ClauseVars, Missing) :-
    ( member(V, ClauseVars) ->
        find_missing_variables(Rest, ClauseVars, Missing)
    ;
        find_missing_variables(Rest, ClauseVars, RestMissing),
        Missing = [V | RestMissing]
    ).

% ========== LITERAL CONVERSION ==========

% Extract literals from a disjunction (or chain)
disjunction_to_literals(or(A, B), Literals) :- !,
    disjunction_to_literals(A, LA),
    disjunction_to_literals(B, LB),
    append(LA, LB, Literals).
disjunction_to_literals(Literal, [Literal]).

% Extract literals from a conjunction (and chain)
conjunction_to_literals(and(A, B), Literals) :- !,
    conjunction_to_literals(A, LA),
    conjunction_to_literals(B, LB),
    append(LA, LB, Literals).
conjunction_to_literals(Literal, [Literal]).

% Rebuild disjunction from literals
literals_to_disjunction([L], L) :- !.
literals_to_disjunction([L | Rest], or(L, Disjunction)) :-
    literals_to_disjunction(Rest, Disjunction).

% Rebuild conjunction from literals
literals_to_conjunction([L], L) :- !.
literals_to_conjunction([L | Rest], and(L, Conjunction)) :-
    literals_to_conjunction(Rest, Conjunction).

% Sort literals in canonical order
sort_literals(Literals, SortedLiterals) :-
    sort(Literals, SortedLiterals).

% ========== BIT PATTERN GENERATION ==========

% Generate all binary patterns for N bits
generate_bit_patterns(N, Patterns) :-
    Max is 2 ^ N - 1,
    generate_bit_patterns_helper(0, Max, N, Patterns).

generate_bit_patterns_helper(Current, Max, _, []) :-
    Current > Max, !.
generate_bit_patterns_helper(Current, Max, N, [Pattern | Rest]) :-
    Current =< Max,
    num_to_bits(Current, N, Pattern),
    Next is Current + 1,
    generate_bit_patterns_helper(Next, Max, N, Rest).

% Convert a number to a list of N bits
num_to_bits(Num, N, Bits) :-
    num_to_bits_helper(Num, N, [], Bits).

num_to_bits_helper(_, 0, Acc, Acc) :- !.
num_to_bits_helper(Num, N, Acc, Bits) :-
    N > 0,
    Bit is Num mod 2,
    Num1 is Num // 2,
    N1 is N - 1,
    num_to_bits_helper(Num1, N1, [Bit | Acc], Bits).

% Convert variables with bit pattern to literals (1=positive, 0=negative)
vars_bits_to_literals([], [], []).
vars_bits_to_literals([var(V) | VRest], [Bit | BRest], [Literal | LRest]) :-
    ( Bit = 1 ->
        Literal = var(V)
    ;
        Literal = not(var(V))
    ),
    vars_bits_to_literals(VRest, BRest, LRest).

% ========== LIST UTILITIES ==========

% Flatten nested list of clauses/terms
flatten_clause_list([], []).
flatten_clause_list([H | T], Flat) :-
    is_list(H), !,
    flatten_clause_list(H, FH),
    flatten_clause_list(T, FT),
    append(FH, FT, Flat).
flatten_clause_list([H | T], [H | FT]) :-
    flatten_clause_list(T, FT).

% ========== CANONICAL CNF ==========

% Canonicalize CNF: expand each clause with all variables, normalize, remove redundant
canonicalize_cnf(Cnf, AllVars, CanonicalCnf) :-
    cnf_to_clause_list(Cnf, Clauses),
    normalize_clauses(Clauses, NormalizedClauses),
    remove_tautologies(NormalizedClauses, CleanClauses),
    expand_clauses_with_all_variables(CleanClauses, AllVars, ExpandedClauses),
    flatten_clause_list(ExpandedClauses, FlatClauses),
    sort_clauses(FlatClauses, SortedClauses),
    remove_duplicate_clauses(SortedClauses, UniqueClauses),
    clause_list_to_cnf(UniqueClauses, CanonicalCnf).

% Extract clauses from CNF (conjunctions of disjunctions)
cnf_to_clause_list(and(A, B), Clauses) :- !,
    cnf_to_clause_list(A, CA),
    cnf_to_clause_list(B, CB),
    append(CA, CB, Clauses).
cnf_to_clause_list(Clause, [Clause]).

% ------------- CLAUSE EXPANSION ---------------

% Expand each clause to include all variables
expand_clauses_with_all_variables([], _, []).
expand_clauses_with_all_variables([Clause | Rest], AllVars, [ExpandedClauses | Rest2]) :-
    expand_clause_with_all_variables(Clause, AllVars, ExpandedClauses),
    expand_clauses_with_all_variables(Rest, AllVars, Rest2).

% Expand a single clause to include all variables
expand_clause_with_all_variables(Clause, AllVars, ExpandedClauses) :-
    disjunction_to_literals(Clause, ClauseLiterals),
    extract_variables_from_literals(ClauseLiterals, ClauseVars),
    find_missing_variables(AllVars, ClauseVars, MissingVars),
    ( MissingVars = [] ->
        ExpandedClauses = [Clause]
    ;
        generate_clause_combinations(Clause, MissingVars, ExpandedClauses)
    ).

% Generate all combinations of a clause with missing variables for each bit pattern
generate_clause_combinations(Clause, MissingVars, AllCombinations) :-
    length(MissingVars, N),
    generate_bit_patterns(N, Patterns),
    maplist(add_variables_to_clause(Clause, MissingVars), Patterns, AllCombinations).

% Add combination of variables (by bit pattern) to a clause
add_variables_to_clause(Clause, MissingVars, Bits, NewClause) :-
    disjunction_to_literals(Clause, ClauseLiterals),
    vars_bits_to_literals(MissingVars, Bits, NewLiterals),
    append(ClauseLiterals, NewLiterals, AllLiterals),
    sort_literals(AllLiterals, SortedLiterals),
    literals_to_disjunction(SortedLiterals, NewClause).

% Normalize clauses: sort literals in each clause
normalize_clauses([], []).
normalize_clauses([Clause | Rest], [NormalizedClause | NormalizedRest]) :-
    normalize_clause(Clause, NormalizedClause),
    normalize_clauses(Rest, NormalizedRest).

normalize_clause(or(A, B), NormalizedClause) :- !,
    disjunction_to_literals(or(A, B), Literals),
    sort_literals(Literals, SortedLiterals),
    literals_to_disjunction(SortedLiterals, NormalizedClause).
normalize_clause(Literal, Literal).

% Check if a clause is tautological (contains both A and ~A)
is_tautology(Clause) :-
    disjunction_to_literals(Clause, Literals),
    member(X, Literals),
    (X = var(V) -> 
        (member(not(var(V)), Literals) -> true ; fail)
    ;
        X = not(var(V)),
        member(var(V), Literals)
    ).

% Remove tautological clauses
remove_tautologies([], []).
remove_tautologies([Clause | Rest], CleanClauses) :-
    ( is_tautology(Clause) ->
        remove_tautologies(Rest, CleanClauses)
    ;
        remove_tautologies(Rest, CleanRest),
        CleanClauses = [Clause | CleanRest]
    ).

% Sort clauses lexicographically
sort_clauses(Clauses, SortedClauses) :-
    sort(Clauses, SortedClauses).

% Remove duplicate clauses
remove_duplicate_clauses(Clauses, UniqueClauses) :-
    list_to_set(Clauses, UniqueClauses).

% Rebuild CNF from clause list
clause_list_to_cnf([], true).
clause_list_to_cnf([C], C) :- !.
clause_list_to_cnf([C | Rest], and(C, Cnf)) :-
    clause_list_to_cnf(Rest, Cnf).

% ------------- CANONICAL DNF ---------------

% Entry point: canonical DNF from input
canonical_dnf_from_input(Input, CanonicalDnf) :-
    parse_propositional_formula(Input, Ast),
    to_dnf(Ast, Dnf),
    extract_all_variables(Ast, AllVars),
    canonicalize_dnf(Dnf, AllVars, CanonicalDnf).

% Pretty printed canonical DNF
canonical_dnf_pretty_from_input(Input, Pretty) :-
    canonical_dnf_from_input(Input, CanonicalDnf),
    ast_to_symbols(CanonicalDnf, Pretty).

% Canonicalize DNF: expand each term with all variables, normalize, remove redundant
canonicalize_dnf(Dnf, AllVars, CanonicalDnf) :-
    dnf_to_term_list(Dnf, Terms),
    normalize_terms(Terms, NormalizedTerms),
    remove_contradictions(NormalizedTerms, CleanTerms),
    expand_terms_with_all_variables(CleanTerms, AllVars, ExpandedTerms),
    flatten_clause_list(ExpandedTerms, FlatTerms),
    sort_terms(FlatTerms, SortedTerms),
    remove_duplicate_terms(SortedTerms, UniqueTerms),
    term_list_to_dnf(UniqueTerms, CanonicalDnf).

% Extract terms from DNF (disjunctions of conjunctions)
dnf_to_term_list(or(A, B), Terms) :- !,
    dnf_to_term_list(A, TA),
    dnf_to_term_list(B, TB),
    append(TA, TB, Terms).
dnf_to_term_list(Term, [Term]).

% Normalize terms: sort literals in each term
normalize_terms([], []).
normalize_terms([Term | Rest], [NormalizedTerm | NormalizedRest]) :-
    normalize_term(Term, NormalizedTerm),
    normalize_terms(Rest, NormalizedRest).

normalize_term(and(A, B), NormalizedTerm) :- !,
    conjunction_to_literals(and(A, B), Literals),
    sort_literals(Literals, SortedLiterals),
    literals_to_conjunction(SortedLiterals, NormalizedTerm).
normalize_term(Literal, Literal).

% Check if a term is contradictory (contains both A and ~A)
is_contradictory(Term) :-
    conjunction_to_literals(Term, Literals),
    member(X, Literals),
    (X = var(V) -> 
        (member(not(var(V)), Literals) -> true ; fail)
    ;
        X = not(var(V)),
        member(var(V), Literals)
    ).

% Remove contradictory terms
remove_contradictions([], []).
remove_contradictions([Term | Rest], CleanTerms) :-
    ( is_contradictory(Term) ->
        remove_contradictions(Rest, CleanTerms)
    ;
        remove_contradictions(Rest, CleanRest),
        CleanTerms = [Term | CleanRest]
    ).

% Expand each term to include all variables
expand_terms_with_all_variables([], _, []).
expand_terms_with_all_variables([Term | Rest], AllVars, [ExpandedTerms | Rest2]) :-
    expand_term_with_all_variables(Term, AllVars, ExpandedTerms),
    expand_terms_with_all_variables(Rest, AllVars, Rest2).

% Expand a single term to include all variables
expand_term_with_all_variables(Term, AllVars, ExpandedTerms) :-
    conjunction_to_literals(Term, TermLiterals),
    extract_variables_from_literals(TermLiterals, TermVars),
    find_missing_variables(AllVars, TermVars, MissingVars),
    ( MissingVars = [] ->
        ExpandedTerms = [Term]
    ;
        generate_term_combinations(Term, MissingVars, ExpandedTerms)
    ).

% Generate all combinations of a term with missing variables for each bit pattern
generate_term_combinations(Term, MissingVars, AllCombinations) :-
    length(MissingVars, N),
    generate_bit_patterns(N, Patterns),
    maplist(add_variables_to_term(Term, MissingVars), Patterns, AllCombinations).

% Add combination of variables (by bit pattern) to a term
add_variables_to_term(Term, MissingVars, Bits, NewTerm) :-
    conjunction_to_literals(Term, TermLiterals),
    vars_bits_to_literals(MissingVars, Bits, NewLiterals),
    append(TermLiterals, NewLiterals, AllLiterals),
    sort_literals(AllLiterals, SortedLiterals),
    literals_to_conjunction(SortedLiterals, NewTerm).

% Sort terms lexicographically
sort_terms(Terms, SortedTerms) :-
    sort(Terms, SortedTerms).

% Remove duplicate terms
remove_duplicate_terms(Terms, UniqueTerms) :-
    list_to_set(Terms, UniqueTerms).

% Rebuild DNF from term list
term_list_to_dnf([], false).
term_list_to_dnf([T], T) :- !.
term_list_to_dnf([T | Rest], or(T, Dnf)) :-
    term_list_to_dnf(Rest, Dnf).
