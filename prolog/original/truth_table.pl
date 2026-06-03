:- consult('minimal.pl').

% truth_table_report(+InputAtom, -VarNames, -Rows, -MDNFPretty, -MCNFPretty, -Props)
% VarNames: atoms (same order as bit columns)
% Rows: list of flat lists [Bit1,...,BitN, F, Md, Mc] (F/Md/Mc in {0,1,-1})
%        -1 means MDNF/MCNF cell not available (sentinel for Python UI as "-")
% Props: [Classification, IsTautology, IsContradiction, IsSatisfiable,
%         EquivAll, MdnfOk, McnfOk, Message] (list for stable pyswip transfer)
truth_table_report(Input, VarNames, Rows, MDNFPretty, MCNFPretty, Props) :-
    parse_propositional_formula(Input, Ast),
    extract_all_variables(Ast, VarTerms),
    maplist(varterm_to_name, VarTerms, VarNames),
    try_minimal_dnf(Input, MdnfAst, MDNFPretty, MdnfOk),
    try_minimal_cnf(Input, McnfAst, MCNFPretty, McnfOk),
    length(VarTerms, N),
    generate_bit_patterns(N, Patterns),
    maplist(truth_table_row(Ast, VarTerms, MdnfAst, McnfAst), Patterns, Rows),
    truth_table_props(Rows, MdnfOk, McnfOk, MdnfAst, McnfAst, Props).

varterm_to_name(var(X), X).

try_minimal_dnf(Input, Ast, Pretty, true) :-
    minimal_dnf_from_input(Input, Ast0),
    ast_to_symbols(Ast0, Pretty),
    Ast = Ast0,
    !.
try_minimal_dnf(_, none, '', false).

try_minimal_cnf(Input, Ast, Pretty, true) :-
    minimal_cnf_from_input(Input, Ast0),
    ast_to_symbols(Ast0, Pretty),
    Ast = Ast0,
    !.
try_minimal_cnf(_, none, '', false).

truth_table_row(Ast, Vars, MdnfAst, McnfAst, Bits, Row) :-
    assignment_from_bits(Vars, Bits, Assignment),
    eval_formula(Ast, Assignment, FVal),
    bool_digit(FVal, Fb),
    optional_minimal_digit(MdnfAst, Assignment, Mdb),
    optional_minimal_digit(McnfAst, Assignment, Mcb),
    append(Bits, [Fb, Mdb, Mcb], Row).

bool_digit(true, 1).
bool_digit(false, 0).

optional_minimal_digit(none, _, -1) :- !.
optional_minimal_digit(Ast, Assignment, D) :-
    eval_formula(Ast, Assignment, V),
    bool_digit(V, D).

truth_table_props(Rows, MdnfOk, McnfOk, MdnfAst, McnfAst,
                  [Classification, Taut, Contra, Sat, Equiv, MdnfOk, McnfOk, Msg]) :-
    maplist(row_main_value, Rows, Fs),
    truth_class_flags(Fs, Taut, Contra, Sat, Classification),
    minimal_form_message(MdnfOk, McnfOk, Msg),
    rows_minimal_equivalent(Rows, MdnfOk, McnfOk, MdnfAst, McnfAst, Equiv).

row_main_value(Row, F) :-
    length(Row, Len),
    Len >= 3,
    IndexF is Len - 2,
    nth1(IndexF, Row, F).

truth_class_flags(Fs, true, false, true, 'Tautology') :-
    maplist(=(1), Fs),
    !.
truth_class_flags(Fs, false, true, false, 'Contradiction') :-
    maplist(=(0), Fs),
    !.
truth_class_flags(_, false, false, true, 'Satisfiable (contingent)').

minimal_form_message(true, true, '') :- !.
minimal_form_message(false, false, 'MDNF: unavailable | MCNF: unavailable') :- !.
minimal_form_message(true, false, 'MCNF: unavailable') :- !.
minimal_form_message(false, true, 'MDNF: unavailable') :- !.

rows_minimal_equivalent(_, _, _, none, _, false) :- !.
rows_minimal_equivalent(_, _, _, _, none, false) :- !.
rows_minimal_equivalent(_, false, _, _, _, false) :- !.
rows_minimal_equivalent(_, _, false, _, _, false) :- !.
rows_minimal_equivalent(Rows, true, true, _, _, Equiv) :-
    ( maplist(row_three_agree, Rows) ->
        Equiv = true
    ; Equiv = false
    ).

row_three_agree(Row) :-
    append(_, [F, Md, Mc], Row),
    Md \= -1,
    Mc \= -1,
    F = Md,
    F = Mc.
