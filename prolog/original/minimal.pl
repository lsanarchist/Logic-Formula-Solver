:- consult('canonical.pl').

minimal_cnf_from_input(Input, MinimalCnf) :-
    parse_propositional_formula(Input, Ast),
    minimize_formula(cnf, Ast, MinimalCnf).

minimal_cnf_pretty_from_input(Input, Pretty) :-
    minimal_cnf_from_input(Input, MinimalCnf),
    ast_to_symbols(MinimalCnf, Pretty).

minimal_dnf_from_input(Input, MinimalDnf) :-
    parse_propositional_formula(Input, Ast),
    minimize_formula(dnf, Ast, MinimalDnf).

minimal_dnf_pretty_from_input(Input, Pretty) :-
    minimal_dnf_from_input(Input, MinimalDnf),
    ast_to_symbols(MinimalDnf, Pretty).

minimize_cnf(Cnf, MinimalCnf) :-
    minimize_formula(cnf, Cnf, MinimalCnf).

minimize_dnf(Dnf, MinimalDnf) :-
    minimize_formula(dnf, Dnf, MinimalDnf).

minimize_formula(dnf, Ast, MinimalDnf) :-
    extract_all_variables(Ast, Vars),
    truth_rows(Ast, Vars, true, TrueRows),
    truth_rows(Ast, Vars, false, FalseRows),
    rows_to_minimal_patterns(TrueRows, FalseRows, Patterns),
    patterns_to_dnf(Vars, Patterns, MinimalDnf).

minimize_formula(cnf, Ast, MinimalCnf) :-
    extract_all_variables(Ast, Vars),
    truth_rows(Ast, Vars, true, TrueRows),
    truth_rows(Ast, Vars, false, FalseRows),
    rows_to_minimal_patterns(FalseRows, TrueRows, Patterns),
    patterns_to_cnf(Vars, Patterns, MinimalCnf).

truth_rows(Ast, Vars, DesiredValue, Rows) :-
    length(Vars, VarCount),
    generate_bit_patterns(VarCount, BitRows),
    include(row_has_value(Ast, Vars, DesiredValue), BitRows, Rows).

row_has_value(Ast, Vars, DesiredValue, Bits) :-
    assignment_from_bits(Vars, Bits, Assignment),
    eval_formula(Ast, Assignment, DesiredValue).

assignment_from_bits([], [], []).
assignment_from_bits([var(V) | Vars], [Bit | Bits], [V-Value | Rest]) :-
    bit_bool(Bit, Value),
    assignment_from_bits(Vars, Bits, Rest).

bit_bool(1, true) :- !.
bit_bool(0, false).

eval_formula(true, _, true) :- !.
eval_formula(false, _, false) :- !.
eval_formula(var(V), Assignment, Value) :- !,
    memberchk(V-Value, Assignment).
eval_formula(not(A), Assignment, Value) :- !,
    eval_formula(A, Assignment, InnerValue),
    bool_not(InnerValue, Value).
eval_formula(and(A, B), Assignment, Value) :- !,
    eval_formula(A, Assignment, LeftValue),
    eval_formula(B, Assignment, RightValue),
    bool_and(LeftValue, RightValue, Value).
eval_formula(or(A, B), Assignment, Value) :- !,
    eval_formula(A, Assignment, LeftValue),
    eval_formula(B, Assignment, RightValue),
    bool_or(LeftValue, RightValue, Value).
eval_formula(imp(A, B), Assignment, Value) :- !,
    eval_formula(A, Assignment, LeftValue),
    eval_formula(B, Assignment, RightValue),
    bool_imp(LeftValue, RightValue, Value).
eval_formula(iff(A, B), Assignment, Value) :- !,
    eval_formula(A, Assignment, LeftValue),
    eval_formula(B, Assignment, RightValue),
    bool_iff(LeftValue, RightValue, Value).

bool_not(true, false).
bool_not(false, true).

bool_and(true, true, true).
bool_and(true, false, false).
bool_and(false, true, false).
bool_and(false, false, false).

bool_or(true, true, true).
bool_or(true, false, true).
bool_or(false, true, true).
bool_or(false, false, false).

bool_imp(true, true, true).
bool_imp(true, false, false).
bool_imp(false, true, true).
bool_imp(false, false, true).

bool_iff(true, true, true).
bool_iff(true, false, false).
bool_iff(false, true, false).
bool_iff(false, false, true).

rows_to_minimal_patterns([], _, []) :- !.
rows_to_minimal_patterns(TargetRows, [], [[]]) :- TargetRows \= [], !.
rows_to_minimal_patterns(TargetRows, NonTargetRows, Patterns) :-
    findall(Candidate,
            valid_candidate(TargetRows, NonTargetRows, Candidate),
            Candidates0),
    sort(Candidates0, Candidates),
    prime_candidates(Candidates, PrimeCandidates),
    optimal_cover(TargetRows, PrimeCandidates, Patterns).

all_patterns(0, [[]]) :- !.
all_patterns(N, Patterns) :-
    N > 0,
    N1 is N - 1,
    all_patterns(N1, RestPatterns),
    findall([Bit | Rest],
            ( member(Bit, [0, 1, x]),
              member(Rest, RestPatterns)
            ),
            Patterns).

valid_candidate(TargetRows, NonTargetRows, c(Pattern, CoveredRows, LiteralCount)) :-
    TargetRows = [FirstRow | _],
    length(FirstRow, VarCount),
    all_patterns(VarCount, Patterns),
    member(Pattern, Patterns),
    findall(Row,
            ( member(Row, TargetRows),
              pattern_covers_row(Pattern, Row)
            ),
            CoveredRows0),
    CoveredRows0 \= [],
    \+ ( member(Row, NonTargetRows),
         pattern_covers_row(Pattern, Row)
       ),
    sort(CoveredRows0, CoveredRows),
    pattern_literal_count(Pattern, LiteralCount).

prime_candidates(Candidates, PrimeCandidates) :-
    exclude(candidate_is_subsumed(Candidates), Candidates, PrimeCandidates0),
    sort(PrimeCandidates0, PrimeCandidates).

candidate_is_subsumed(Candidates, c(Pattern, _, _)) :-
    member(c(OtherPattern, _, _), Candidates),
    OtherPattern \== Pattern,
    pattern_subsumes(OtherPattern, Pattern).

pattern_subsumes([], []).
pattern_subsumes([x | RestA], [_ | RestB]) :- !,
    pattern_subsumes(RestA, RestB).
pattern_subsumes([Bit | RestA], [Bit | RestB]) :-
    Bit \== x,
    pattern_subsumes(RestA, RestB).

pattern_covers_row([], []).
pattern_covers_row([x | RestPattern], [_ | RestRow]) :- !,
    pattern_covers_row(RestPattern, RestRow).
pattern_covers_row([Bit | RestPattern], [Bit | RestRow]) :-
    Bit \== x,
    pattern_covers_row(RestPattern, RestRow).

pattern_literal_count([], 0).
pattern_literal_count([x | Rest], Count) :- !,
    pattern_literal_count(Rest, Count).
pattern_literal_count([_ | Rest], Count) :-
    pattern_literal_count(Rest, RestCount),
    Count is RestCount + 1.

optimal_cover(TargetRows, Candidates, Patterns) :-
    sort(TargetRows, UncoveredRows),
    nb_setval(minimal_cover_best, none),
    cover_branch(UncoveredRows, Candidates, [], 0, 0),
    nb_getval(minimal_cover_best, best(_, _, Patterns)).

cover_branch([], _, SelectedPatterns, TermCount, LiteralCount) :- !,
    sort(SelectedPatterns, Patterns),
    update_best_cover(TermCount, LiteralCount, Patterns).
cover_branch(UncoveredRows, Candidates, SelectedPatterns, TermCount, LiteralCount) :-
    cover_can_improve(TermCount),
    UncoveredRows = [Row | _],
    member(c(Pattern, CoveredRows, PatternLiteralCount), Candidates),
    \+ memberchk(Pattern, SelectedPatterns),
    memberchk(Row, CoveredRows),
    NewTermCount is TermCount + 1,
    cover_can_improve(NewTermCount),
    NewLiteralCount is LiteralCount + PatternLiteralCount,
    remove_covered_rows(UncoveredRows, CoveredRows, RemainingRows),
    cover_branch(RemainingRows, Candidates, [Pattern | SelectedPatterns], NewTermCount, NewLiteralCount),
    fail.
cover_branch(_, _, _, _, _).

cover_can_improve(TermCount) :-
    nb_getval(minimal_cover_best, none), !,
    TermCount >= 0.
cover_can_improve(TermCount) :-
    nb_getval(minimal_cover_best, best(BestTermCount, _, _)),
    TermCount < BestTermCount.

update_best_cover(TermCount, LiteralCount, Patterns) :-
    nb_getval(minimal_cover_best, CurrentBest),
    ( cover_better(TermCount, LiteralCount, Patterns, CurrentBest) ->
        nb_setval(minimal_cover_best, best(TermCount, LiteralCount, Patterns))
    ;
        true
    ).

cover_better(_, _, _, none) :- !.
cover_better(TermCount, _, _, best(BestTermCount, _, _)) :-
    TermCount < BestTermCount, !.
cover_better(TermCount, LiteralCount, _, best(TermCount, BestLiteralCount, _)) :-
    LiteralCount < BestLiteralCount, !.
cover_better(TermCount, LiteralCount, Patterns, best(TermCount, LiteralCount, BestPatterns)) :-
    Patterns @< BestPatterns.

remove_covered_rows([], _, []).
remove_covered_rows([Row | Rest], CoveredRows, RemainingRows) :-
    memberchk(Row, CoveredRows), !,
    remove_covered_rows(Rest, CoveredRows, RemainingRows).
remove_covered_rows([Row | Rest], CoveredRows, [Row | RemainingRows]) :-
    remove_covered_rows(Rest, CoveredRows, RemainingRows).

patterns_to_dnf(_, [], false) :- !.
patterns_to_dnf(_, [[]], true) :- !.
patterns_to_dnf(Vars, Patterns, Dnf) :-
    maplist(pattern_to_dnf_term(Vars), Patterns, Terms),
    term_list_to_dnf(Terms, Dnf).

pattern_to_dnf_term(Vars, Pattern, Term) :-
    pattern_to_dnf_literals(Vars, Pattern, Literals),
    literals_to_conjunction(Literals, Term).

pattern_to_dnf_literals([], [], []).
pattern_to_dnf_literals([_ | Vars], [x | Pattern], Literals) :- !,
    pattern_to_dnf_literals(Vars, Pattern, Literals).
pattern_to_dnf_literals([var(V) | Vars], [1 | Pattern], [var(V) | Literals]) :- !,
    pattern_to_dnf_literals(Vars, Pattern, Literals).
pattern_to_dnf_literals([var(V) | Vars], [0 | Pattern], [not(var(V)) | Literals]) :-
    pattern_to_dnf_literals(Vars, Pattern, Literals).

patterns_to_cnf(_, [], true) :- !.
patterns_to_cnf(_, [[]], false) :- !.
patterns_to_cnf(Vars, Patterns, Cnf) :-
    maplist(pattern_to_cnf_clause(Vars), Patterns, Clauses),
    clause_list_to_cnf(Clauses, Cnf).

pattern_to_cnf_clause(Vars, Pattern, Clause) :-
    pattern_to_cnf_literals(Vars, Pattern, Literals),
    literals_to_disjunction(Literals, Clause).

pattern_to_cnf_literals([], [], []).
pattern_to_cnf_literals([_ | Vars], [x | Pattern], Literals) :- !,
    pattern_to_cnf_literals(Vars, Pattern, Literals).
pattern_to_cnf_literals([var(V) | Vars], [0 | Pattern], [var(V) | Literals]) :- !,
    pattern_to_cnf_literals(Vars, Pattern, Literals).
pattern_to_cnf_literals([var(V) | Vars], [1 | Pattern], [not(var(V)) | Literals]) :-
    pattern_to_cnf_literals(Vars, Pattern, Literals).
