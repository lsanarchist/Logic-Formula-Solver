:- consult('truth_table.pl').

% Mimi
% VarNames: sorted variables from both formulas.
% Equivalent: true if both formulas have the same value in every row.
% Counterexample: [] when equivalent, otherwise the first row where values differ.

logical_equivalence_report(InputA, InputB, VarNames, Rows, Equivalent, Counterexample) :-
    parse_propositional_formula(InputA, AstA),
    parse_propositional_formula(InputB, AstB),
    shared_formula_variables(AstA, AstB, Vars),
    maplist(varterm_to_name, Vars, VarNames),
    length(Vars, VarCount),
    generate_bit_patterns(VarCount, Patterns),
    maplist(equivalence_row(AstA, AstB, Vars), Patterns, Rows), 
    equivalence_result(Rows, Equivalent, Counterexample).


% equivalence_row will produce rows with bits and values for both formulas
equivalence_row(AstA, AstB, Vars, Bits, Row) :-
    assignment_from_bits(Vars, Bits, Assignment),
    eval_formula(AstA, Assignment, ValueA),
    eval_formula(AstB, Assignment, ValueB),
    bool_digit(ValueA, DigitA),
    bool_digit(ValueB, DigitB),
    append(Bits, [DigitA, DigitB], Row).

    
equivalence_result(Rows, false, Counterexample) :-
    member(Counterexample, Rows),
    append(_, [ValueA, ValueB], Counterexample),
    ValueA \= ValueB,
    !.
equivalence_result(_, true, []).



logical_equivalent(InputA, InputB) :-
    parse_propositional_formula(InputA, AstA),
    parse_propositional_formula(InputB, AstB),
    shared_formula_variables(AstA, AstB, Vars),
    equivalent_on_all_assignments(AstA, AstB, Vars).

shared_formula_variables(AstA, AstB, Vars) :-
    extract_all_variables(AstA, VarsA),
    extract_all_variables(AstB, VarsB),
    append(VarsA, VarsB, Vars0),
    sort(Vars0, Vars).


equivalent_on_all_assignments(AstA, AstB, Vars) :-
    length(Vars, VarCount),
    generate_bit_patterns(VarCount, Patterns),
    forall(member(Bits, Patterns), same_value_for_bits(AstA, AstB, Vars, Bits)).

same_value_for_bits(AstA, AstB, Vars, Bits) :-
    assignment_from_bits(Vars, Bits, Assignment),
    eval_formula(AstA, Assignment, Value),
    eval_formula(AstB, Assignment, Value).
