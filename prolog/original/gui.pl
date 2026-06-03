:- use_module(library(pce)).
:- use_module(library(lists)).

:- dynamic gui_frame/1.
:- dynamic gui_picture/1.
:- dynamic gui_input/1.
:- dynamic gui_loaded/0.
:- dynamic gui_mode/1.

:- dynamic node_seq/1.
:- dynamic node_data/6.          % node_data(Id, Kind, Label, Tvar, RootVar, Children)
:- dynamic subtree_leaves/2.
:- dynamic node_layout/3.        % node_layout(Id, X, Y)
:- dynamic node_box/2.
:- dynamic node_clause_indexes/2.
:- dynamic edge_obj/1.
:- dynamic info_obj/1.
:- dynamic clause_text_obj/2.
:- dynamic clause_term/2.
:- dynamic root_var_gui/1.
:- dynamic last_input/1.
:- dynamic clause_count_gui/1.


start_gui :-
    (   retract(gui_frame(F0))
    ->  catch(send(F0, destroy), _, true)
    ;   true
    ),
    clear_runtime_state,
    new(F, frame('Tseitin XPCE Visualizer')),
    new(D, dialog),
    send(D, append, new(I, text_item(formula, 'a->b->c'))),
    send(I, length, 60),
    send(D, append, button(transform,  message(@prolog, gui_transform))),
    send(D, append, button(parse_tree, message(@prolog, gui_parse_tree))),
    send(D, append, button(clear,      message(@prolog, gui_clear))),
    send(D, append, button(quit,       message(F, destroy))),
    send(D, append,
         label(help,
               'Examples: a->b->c   ~(a&b)->c   (a|b)&(c->d)')),
    send(F, append, D),
    new(P, picture),
    send(P, size, size(1260, 760)),
    send(P, background, colour(white)),
    send(F, append, P),
    send(P, below, D),
    assertz(gui_frame(F)),
    assertz(gui_picture(P)),
    assertz(gui_input(I)),
    reset_canvas,
    draw_initial_message,
    send(F, open).


gui_transform :-
    render_from_input(tseitin).


gui_parse_tree :-
    render_from_input(parser_propositional).


render_from_input(Mode) :-
    clear_model_state,
    reset_canvas,
    (   gui_input(I),
        get(I, selection, Raw),
        normalize_gui_text(Raw, Input0)
    ->  true
    ;   Input0 = ''
    ),
    normalize_space(string(InputS), Input0),
    (   InputS == ""
    ->  show_error('Please enter a formula first.')
    ;   atom_string(Input, InputS),
        catch(ensure_support_loaded, E,
              (message_to_string(E, Msg), show_error(Msg), fail))
    ->  (   catch(run_mode(Mode, Input), E2,
                  (message_to_string(E2, Msg2), show_error(Msg2), fail))
        ->  true
        ;   show_error('Rendering failed while building the tree.')
        )
    ;   true
    ).


gui_clear :-
    clear_model_state,
    reset_canvas,
    (   gui_input(I)
    ->  catch(send(I, selection, ''), _, true)
    ;   true
    ),
    draw_initial_message.


gui_select_node(Id) :-
    update_node_selection_visuals(Id),
    render_info_panel(Id),
    (   node_clause_indexes(Id, Idxs)
    ->  render_clause_panel(Idxs)
    ;   render_clause_panel([])
    ).


run_mode(tseitin, Input) :-
    prepare_visual_data(Input, Tree, ClauseTerms, RootVar, Error),
    (   var(Error)
    ->  assertz(gui_mode(tseitin)),
        build_model(Tree, RootId),
        assertz(root_var_gui(RootVar)),
        assertz(last_input(Input)),
        length(ClauseTerms, ClauseCount),
        assertz(clause_count_gui(ClauseCount)),
        store_clauses(ClauseTerms),
        assign_local_clause_sets(Tree),
        layout_model(RootId),
        render_tree,
        gui_select_node(RootId)
    ;   show_error(Error)
    ).

run_mode(parser_propositional, Input) :-
    prepare_parser_visual_data(Input, Tree, Error),
    (   var(Error)
    ->  assertz(gui_mode(parser)),
        build_model(Tree, RootId),
        assertz(last_input(Input)),
        assign_empty_clause_sets,
        layout_model(RootId),
        render_tree,
        gui_select_node(RootId)
    ;   show_error(Error)
    ).


prepare_visual_data(Input, Tree, ClauseTerms, RootVar, Error) :-
    capture_goal(tseitin_annotated_tree(Input, Tree), OkTree, MsgTree),
    (   OkTree == true
    ->  capture_goal(tseitin_formula(Input, TF), OkFormula, MsgFormula),
        (   OkFormula == true
        ->  TF = and(ClauseConjunction, RootVar),
            flatten_conjunction(ClauseConjunction, Clauses0),
            append(Clauses0, [RootVar], ClauseTerms)
        ;   normalize_error_message(MsgFormula, 'Transformation failed while computing clauses.', Error)
        )
    ;   normalize_error_message(MsgTree, 'Transformation failed while building the annotated tree.', Error)
    ).


prepare_parser_visual_data(Input, Tree, Error) :-
    (   try_parser_candidates(Input, Tree)
    ->  true
    ;   Error = 'Could not build a parser-only tree. I tried common parser predicates: parse_propositional_formula/2, parse/2, parser/2, parse_expr/2, parse_expression/2, formula_ast/2, parsed_formula/2.'
    ).


try_parser_candidates(InputAtom, Tree) :-
    atom_string(InputAtom, InputString),
    parser_candidate(Name, Kind),
    parser_input(Kind, InputAtom, InputString, ParserInput),
    Goal =.. [Name, ParserInput, Tree0],
    catch(call(Goal), _, fail),
    nonvar(Tree0),
    Tree0 \== [],
    Tree = Tree0,
    !.


parser_candidate(parse_propositional_formula, atom).
parser_candidate(parse_propositional_formula, string).
parser_candidate(parse, atom).
parser_candidate(parse, string).
parser_candidate(parser, atom).
parser_candidate(parser, string).
parser_candidate(parse_expr, atom).
parser_candidate(parse_expr, string).
parser_candidate(parse_expression, atom).
parser_candidate(parse_expression, string).
parser_candidate(formula_ast, atom).
parser_candidate(formula_ast, string).
parser_candidate(parsed_formula, atom).
parser_candidate(parsed_formula, string).


parser_input(atom, InputAtom, _InputString, InputAtom).
parser_input(string, _InputAtom, InputString, InputString).


capture_goal(Goal, Ok, Msg) :-
    catch(
        with_output_to(string(Out),
                       (   Goal
                       ->  Ok = true
                       ;   Ok = false
                       )),
        E,
        (   message_to_string(E, Msg0),
            Ok = false,
            Msg = Msg0,
            !
        )
    ),
    (   var(Msg)
    ->  Msg = Out
    ;   true
    ).


normalize_error_message(Msg0, Default, Msg) :-
    normalize_space(string(Msg1), Msg0),
    (   Msg1 == ""
    ->  Msg = Default
    ;   Msg = Msg1
    ).


ensure_support_loaded :-
    gui_loaded,
    !.
ensure_support_loaded :-
    gui_source_dir(Dir),
    maybe_load_file(Dir, 'parser_propositional.pl'),
    maybe_load_file(Dir, 'pretty_print.pl'),
    maybe_load_file(Dir, 'tseitin.pl'),
    assertz(gui_loaded).


maybe_load_file(Dir, Name) :-
    directory_file_path(Dir, Name, Path),
    (   exists_file(Path)
    ->  ensure_loaded(Path)
    ;   true
    ).


gui_source_dir(Dir) :-
    source_file(start_gui/0, ThisFile),
    !,
    file_directory_name(ThisFile, Dir).
gui_source_dir(Dir) :-
    working_directory(Dir, Dir).


normalize_gui_text(Raw, Text) :-
    (   var(Raw)
    ->  Text = ""
    ;   string(Raw)
    ->  Text = Raw
    ;   atom(Raw)
    ->  atom_string(Raw, Text)
    ;   catch(get(Raw, value, V), _, fail)
    ->  normalize_gui_text(V, Text)
    ;   term_string(Raw, Text)
    ).


clear_runtime_state :-
    retractall(gui_picture(_)),
    retractall(gui_input(_)),
    retractall(gui_loaded),
    clear_model_state,
    clear_dynamic_visuals.


clear_model_state :-
    retractall(node_seq(_)),
    retractall(node_data(_, _, _, _, _, _)),
    retractall(subtree_leaves(_, _)),
    retractall(node_layout(_, _, _)),
    retractall(node_clause_indexes(_, _)),
    retractall(clause_term(_, _)),
    retractall(root_var_gui(_)),
    retractall(last_input(_)),
    retractall(clause_count_gui(_)),
    retractall(gui_mode(_)).


clear_dynamic_visuals :-
    forall(retract(edge_obj(L)),           catch(send(L, free), _, true)),
    retractall(node_box(_, _)),
    forall(retract(info_obj(O)),           catch(send(O, free), _, true)),
    forall(retract(clause_text_obj(_, O)), catch(send(O, free), _, true)).


reset_canvas :-
    clear_dynamic_visuals,
    (   gui_picture(P)
    ->  catch(send(P, clear), _, true)
    ;   true
    ),
    draw_static_layout.


store_clauses(ClauseTerms) :-
    forall(nth1(I, ClauseTerms, Clause), assertz(clause_term(I, Clause))).


build_model(Tree, RootId) :-
    retractall(node_seq(_)),
    assertz(node_seq(0)),
    build_model_(Tree, RootId, _).


build_model_(leaf(X), Id, Root) :-
    !,
    next_node_id(Id),
    leaf_payload(X, Label, Root),
    assertz(node_data(Id, leaf, Label, none, Root, [])),
    assertz(subtree_leaves(Id, 1)).
build_model_(node1(A, Op0, Sub), Id, A) :-
    !,
    next_node_id(Id),
    normalize_operator(Op0, Op),
    build_model_(Sub, SubId, _),
    operator_label(Op, Label),
    assertz(node_data(Id, unary, Label, A, A, [SubId])),
    subtree_leaves(SubId, N),
    assertz(subtree_leaves(Id, N)).
build_model_(node(A, Op0, L, R), Id, A) :-
    !,
    next_node_id(Id),
    normalize_operator(Op0, Op),
    build_model_(L, LId, _),
    build_model_(R, RId, _),
    operator_label(Op, Label),
    assertz(node_data(Id, binary, Label, A, A, [LId, RId])),
    subtree_leaves(LId, NL),
    subtree_leaves(RId, NR),
    N is NL + NR,
    assertz(subtree_leaves(Id, N)).
build_model_(Term, Id, Root) :-
    formula_unary_term(Term, Op, Sub),
    !,
    next_node_id(Id),
    build_model_(Sub, SubId, _),
    operator_label(Op, Label),
    Root = none,
    assertz(node_data(Id, unary, Label, none, none, [SubId])),
    subtree_leaves(SubId, N),
    assertz(subtree_leaves(Id, N)).
build_model_(Term, Id, Root) :-
    formula_binary_term(Term, Op, L, R),
    !,
    next_node_id(Id),
    build_model_(L, LId, _),
    build_model_(R, RId, _),
    operator_label(Op, Label),
    Root = none,
    assertz(node_data(Id, binary, Label, none, none, [LId, RId])),
    subtree_leaves(LId, NL),
    subtree_leaves(RId, NR),
    N is NL + NR,
    assertz(subtree_leaves(Id, N)).
build_model_(var(X), Id, X) :-
    !,
    next_node_id(Id),
    assertz(node_data(Id, leaf, X, none, X, [])),
    assertz(subtree_leaves(Id, 1)).
build_model_(X, Id, X) :-
    atomic(X),
    !,
    next_node_id(Id),
    assertz(node_data(Id, leaf, X, none, X, [])),
    assertz(subtree_leaves(Id, 1)).
build_model_(Term, Id, Root) :-
    next_node_id(Id),
    term_string(Term, S),
    Root = none,
    assertz(node_data(Id, leaf, S, none, none, [])),
    assertz(subtree_leaves(Id, 1)).


leaf_payload(var(X), X, X) :- !.
leaf_payload(X, X, X).


formula_unary_term(Term, not, Sub) :-
    compound(Term),
    Term =.. [Op0, Sub],
    normalize_operator(Op0, not).

formula_binary_term(Term, Op, L, R) :-
    compound(Term),
    Term =.. [Op0, L, R],
    normalize_operator(Op0, Op),
    Op \== not.


next_node_id(Id) :-
    retract(node_seq(N0)),
    N is N0 + 1,
    assertz(node_seq(N)),
    atom_concat(n, N, Id).


normalize_operator(not, not).
normalize_operator(neg, not).
normalize_operator('~', not).
normalize_operator(and, and).
normalize_operator('&', and).
normalize_operator('/\\', and).
normalize_operator(or, or).
normalize_operator('|', or).
normalize_operator('\\/', or).
normalize_operator(imp, imp).
normalize_operator('->', imp).
normalize_operator(implies, imp).
normalize_operator(iff, iff).
normalize_operator('<->', iff).
normalize_operator(equiv, iff).


operator_label(not, '~').
operator_label(and, '&').
operator_label(or,  '|').
operator_label(imp, '->').
operator_label(iff, '<->').


assign_empty_clause_sets :-
    forall(node_data(Id, _Kind, _Label, _Tvar, _RootVar, _Children),
           assertz(node_clause_indexes(Id, []))).


assign_local_clause_sets(Tree) :-
    forall(
        node_data(Id, Kind, _Label, _Tvar, RootVar, _Children),
        (   Kind == leaf
        ->  assertz(node_clause_indexes(Id, []))
        ;   find_local_clause_indexes(Tree, RootVar, Idxs),
            assertz(node_clause_indexes(Id, Idxs))
        )
    ).

find_local_clause_indexes(Tree, Var, Idxs) :-
    (   tree_node_local_clauses(Tree, Var, LocalClauses)
    ->  findall(
            I,
            (
                clause_term(I, StoredClause),
                member(LocalClause, LocalClauses),
                StoredClause =@= LocalClause
            ),
            RawIdxs
        ),
        sort(RawIdxs, Idxs)
    ;   Idxs = []
    ).


flatten_conjunction(true, []) :- !.
flatten_conjunction(Term, Clauses) :-
    compound(Term),
    Term =.. [and | Args],
    !,
    maplist(flatten_conjunction, Args, Nested),
    append_all_lists(Nested, Clauses).
flatten_conjunction(Term, [Term]).


append_all_lists(Lists, Result) :-
    foldl(append, Lists, [], Result).


layout_model(RootId) :-
    retractall(node_layout(_, _, _)),
    tree_pane(Left, Top, Width, _Height),
    subtree_leaves(RootId, LeafCount),
    node_box_size(NodeW, _),
    Gap0 is max(70, (Width - 80) // max(1, LeafCount)),
    LeafGap is min(140, Gap0),
    BaseX is Left + max(50, (Width - max(NodeW, LeafCount * LeafGap)) // 2) + NodeW // 2,
    BaseY is Top + 40,
    LevelGap = 90,
    layout_node(RootId, 0, _, 0, BaseX, BaseY, LeafGap, LevelGap, _).


layout_node(Id, Index0, Index1, Depth, BaseX, BaseY, LeafGap, LevelGap, CenterX) :-
    node_data(Id, Kind, _Label, _Tvar, _RootVar, Children),
    Y is BaseY + Depth * LevelGap,
    (   Kind == leaf
    ->  CenterX is BaseX + Index0 * LeafGap,
        Index1 is Index0 + 1
    ;   Kind == unary
    ->  Children = [C],
        layout_node(C, Index0, Index1, Depth + 1, BaseX, BaseY, LeafGap, LevelGap, ChildX),
        CenterX = ChildX
    ;   Kind == binary
    ->  Children = [L, R],
        layout_node(L, Index0, Mid, Depth + 1, BaseX, BaseY, LeafGap, LevelGap, LeftX),
        layout_node(R, Mid, Index1, Depth + 1, BaseX, BaseY, LeafGap, LevelGap, RightX),
        CenterX is (LeftX + RightX) // 2
    ),
    node_box_size(NodeW, _NodeH),
    X is CenterX - NodeW // 2,
    assertz(node_layout(Id, X, Y)).


render_tree :-
    gui_picture(P),
    forall(
        node_data(Id, _Kind, _Label, _Tvar, _RootVar, Children),
        forall(member(ChildId, Children), draw_edge_from_layout(P, Id, ChildId))
    ),
    forall(node_layout(Id, X, Y), create_node_device(P, Id, X, Y)).


create_node_device(P, Id, X, Y) :-
    node_data(Id, Kind, Label, Tvar, _RootVar, _Children),
    node_box_size(W, H),
    new(D, device),
    new(B, box(W, H)),
    send(B, pen, 1),
    send(B, colour, colour(black)),
    send(B, fill_pattern, colour(grey95)),
    send(D, display, B),
    format(string(SMain), '~w', [Label]),
    new(TMain, text(SMain)),
    send(TMain, font, font(screen, bold, 13)),
    send(TMain, colour, colour(black)),
    (   Kind == leaf
    ->  send(D, display, TMain, point(18, 14))
    ;   Tvar == none
    ->  send(D, display, TMain, point(34, 14))
    ;   format(string(SSub), '~w', [Tvar]),
        new(TSub, text(SSub)),
        send(TSub, font, font(screen, roman, 11)),
        send(TSub, colour, colour(black)),
        send(D, display, TMain, point(14, 6)),
        send(D, display, TSub, point(14, 24))
    ),
    send(P, display, D, point(X, Y)),
    assertz(node_box(Id, B)),
    new(Click,
        click_gesture(left, '', single,
                      message(@prolog, gui_select_node, Id))),
    send(D, recogniser, Click).


draw_edge_from_layout(P, ParentId, ChildId) :-
    node_box_size(W, H),
    node_layout(ParentId, PX, PY),
    node_layout(ChildId,  CX, CY),
    X1 is PX + W // 2,
    Y1 is PY + H,
    X2 is CX + W // 2,
    Y2 is CY,
    new(L, line(X1, Y1, X2, Y2)),
    send(L, colour, colour(grey40)),
    send(P, display, L),
    assertz(edge_obj(L)).


update_node_selection_visuals(SelectedId) :-
    forall(
        node_box(Id, B),
        (   Id == SelectedId
        ->  send(B, pen, 3),
            send(B, colour, colour(darkgreen))
        ;   send(B, pen, 1),
            send(B, colour, colour(black))
        )
    ).


render_info_panel(NodeId) :-
    clear_info_panel,
    info_pane(X, Y, _W, _H),
    X0 is X + 16,
    Y0 is Y + 18,
    draw_info_text(X0, Y0, 'Selected node', bold),
    Y1 is Y0 + 28,
    (   gui_mode(Mode) -> true ; Mode = tseitin),
    (   last_input(Input) -> true ; Input = ''),
    node_data(NodeId, Kind, Label, Tvar, Root, Children),
    node_kind_name(Kind, KindName),
    format(string(SMode), 'Mode: ~w', [Mode]),
    format(string(SIn), 'Input: ~w', [Input]),
    format(string(SK), 'Type: ~w', [KindName]),
    format(string(SL), 'Operator / atom: ~w', [Label]),
    length(Children, Arity),
    format(string(SA), 'Children: ~d', [Arity]),
    draw_info_text(X0, Y1, SMode, normal),
    Y2 is Y1 + 22,
    draw_info_text(X0, Y2, SIn, normal),
    Y3 is Y2 + 30,
    draw_info_text(X0, Y3, SK, normal),
    Y4 is Y3 + 22,
    draw_info_text(X0, Y4, SL, normal),
    Y5 is Y4 + 22,
    (   Mode == tseitin
    ->  render_info_panel_tseitin(NodeId, X0, Y5, Tvar, Root, SA)
    ;   render_info_panel_parser(X0, Y5, Tvar, Root, SA)
    ).


render_info_panel_tseitin(NodeId, X0, Y0, Tvar, Root, SA) :-
    (   root_var_gui(RootVar) -> true ; RootVar = '-'),
    (   clause_count_gui(Count) -> true ; Count = 0),
    format(string(SRoot), 'Root Tseitin variable: ~w', [RootVar]),
    format(string(SNodeRoot), 'Node root variable: ~w', [Root]),
    (   Tvar == none
    ->  ST = 'Tseitin variable: -'
    ;   format(string(ST), 'Tseitin variable: ~w', [Tvar])
    ),
    format(string(SCount), 'Total clauses shown below: ~d', [Count]),
    draw_info_text(X0, Y0, SRoot, normal),
    Y1 is Y0 + 22,
    draw_info_text(X0, Y1, SNodeRoot, normal),
    Y2 is Y1 + 22,
    draw_info_text(X0, Y2, ST, normal),
    Y3 is Y2 + 22,
    draw_info_text(X0, Y3, SA, normal),
    Y4 is Y3 + 30,
    draw_info_text(X0, Y4, SCount, normal),
    Y5 is Y4 + 30,
    draw_info_text(X0, Y5, 'Local clauses', bold),
    Y6 is Y5 + 26,
    (   node_clause_indexes(NodeId, Idxs),
        Idxs \= []
    ->  draw_local_clause_lines(Idxs, X0, Y6)
    ;   draw_info_text(X0, Y6, '(No local clauses for this node)', normal)
    ).


render_info_panel_parser(X0, Y0, Tvar, Root, SA) :-
    (   Root \== none
    ->  format(string(SRoot), 'Stored root info: ~w', [Root]),
        draw_info_text(X0, Y0, SRoot, normal),
        Y1 is Y0 + 22
    ;   Y1 = Y0
    ),
    (   Tvar \== none
    ->  format(string(ST), 'Auxiliary value: ~w', [Tvar]),
        draw_info_text(X0, Y1, ST, normal),
        Y2 is Y1 + 22
    ;   Y2 = Y1
    ),
    draw_info_text(X0, Y2, SA, normal),
    Y3 is Y2 + 30,
    draw_info_text(X0, Y3, 'Parser-only tree: no CNF clauses.', bold).


render_clause_panel(HighlightIdxs) :-
    clear_clause_panel,
    clauses_pane(X, Y, _W, H),
    X0 is X + 16,
    Y0 is Y + 18,
    (   gui_mode(parser)
    ->  draw_clause_text(0, X0, Y0, 'Parser-only mode', bold, false),
        draw_clause_text(0, X0, Y0 + 24, 'No CNF clauses are produced in this view.', normal, false)
    ;   draw_clause_text(0, X0, Y0, 'All CNF clauses', bold, false),
        findall(I-Clause, clause_term(I, Clause), Pairs),
        length(Pairs, Count),
        VisibleHeight is H - 40,
        Step is max(14, min(22, VisibleHeight // max(1, Count + 1))),
        FontSize is max(8, Step - 4),
        render_clause_lines(Pairs, HighlightIdxs, X0, Y0, Step, FontSize, H)
    ).


render_clause_lines([], _HighlightIdxs, _X, _Y0, _Step, _FontSize, _H).
render_clause_lines([I-Clause | Rest], HighlightIdxs, X, Y0, Step, FontSize, H) :-
    clauses_pane(_PX, PY, _PW, _PH),
    Row is I,
    Y is Y0 + Row * Step,
    MaxY is PY + H - 16,
    (   Y > MaxY
    ->  draw_clause_text(-1, X, MaxY - Step, '...', normal, false)
    ;   pretty_term(Clause, Pretty),
        format(string(Line), '~d. ~w', [I, Pretty]),
        (memberchk(I, HighlightIdxs) -> Highlight = true ; Highlight = false),
        draw_clause_text(I, X, Y, Line, font(FontSize), Highlight),
        render_clause_lines(Rest, HighlightIdxs, X, Y0, Step, FontSize, H)
    ).


draw_local_clause_lines([], _X, _Y).
draw_local_clause_lines([I | Rest], X, Y) :-
    clause_term(I, Clause),
    pretty_term(Clause, Pretty),
    format(string(Line), '~d. ~w', [I, Pretty]),
    draw_info_text(X, Y, Line, normal),
    Y1 is Y + 20,
    draw_local_clause_lines(Rest, X, Y1).


pretty_term(Term, Pretty) :-
    catch(ast_to_symbols(Term, Pretty), _, term_string(Term, Pretty)).


node_kind_name(leaf,  'leaf').
node_kind_name(unary, 'unary').
node_kind_name(binary,'binary').


clear_info_panel :-
    forall(retract(info_obj(O)), catch(send(O, free), _, true)).


clear_clause_panel :-
    forall(retract(clause_text_obj(_, O)), catch(send(O, free), _, true)).


draw_static_layout :-
    gui_picture(P),
    tree_pane(TX, TY, TW, TH),
    info_pane(IX, IY, IW, IH),
    clauses_pane(CX, CY, CW, CH),
    new(TreeBox, box(TW, TH)),
    send(TreeBox, colour, colour(black)),
    send(P, display, TreeBox, point(TX, TY)),
    new(InfoBox, box(IW, IH)),
    send(InfoBox, colour, colour(black)),
    send(P, display, InfoBox, point(IX, IY)),
    new(ClausesBox, box(CW, CH)),
    send(ClausesBox, colour, colour(black)),
    send(P, display, ClausesBox, point(CX, CY)),
    new(T1, text('Formula tree')),
    send(T1, font, font(screen, bold, 14)),
    send(T1, colour, colour(black)),
    send(P, display, T1, point(TX + 12, TY - 18)),
    new(T2, text('Node details')),
    send(T2, font, font(screen, bold, 14)),
    send(T2, colour, colour(black)),
    send(P, display, T2, point(IX + 12, IY - 18)),
    new(T3, text('Clauses / parser output')),
    send(T3, font, font(screen, bold, 14)),
    send(T3, colour, colour(black)),
    send(P, display, T3, point(CX + 12, CY - 18)).


draw_initial_message :-
    clear_info_panel,
    clear_clause_panel,
    info_pane(X, Y, _W, _H),
    X0 is X + 16,
    Y0 is Y + 18,
    draw_info_text(X0, Y0, 'Enter a formula and choose a mode.', bold),
    Y1 is Y0 + 28,
    draw_info_text(X0, Y1, 'Transform = parser + Tseitin clauses.', normal),
    Y2 is Y1 + 22,
    draw_info_text(X0, Y2, 'Parse_tree = only the parser tree from parser_propositional.pl.', normal),
    Y3 is Y2 + 22,
    draw_info_text(X0, Y3, 'Clear wipes the canvas and resets the formula field.', normal),
    clauses_pane(CX, CY, _CW, _CH),
    draw_clause_text(0, CX + 16, CY + 18, 'No clauses yet.', normal, false).


show_error(Message) :-
    clear_info_panel,
    clear_clause_panel,
    info_pane(X, Y, _W, _H),
    X0 is X + 16,
    Y0 is Y + 18,
    draw_info_text(X0, Y0, 'Error', bold),
    Y1 is Y0 + 28,
    draw_info_wrapped(Message, X0, Y1, 52),
    clauses_pane(CX, CY, _CW, _CH),
    draw_clause_text(0, CX + 16, CY + 18, 'No clauses to display.', normal, false).


draw_info_wrapped(Message, X, Y, Width) :-
    wrap_words(Message, Width, Lines),
    draw_info_lines(Lines, X, Y).


draw_info_lines([], _X, _Y).
draw_info_lines([Line | Rest], X, Y) :-
    draw_info_text(X, Y, Line, normal),
    Y1 is Y + 20,
    draw_info_lines(Rest, X, Y1).


wrap_words(Text, Width, Lines) :-
    split_string(Text, " ", "", Words),
    wrap_words_(Words, Width, "", [], Rev),
    reverse(Rev, Lines).

wrap_words_([], _Width, "", Acc, Acc) :- !.
wrap_words_([], _Width, Current, Acc, [Current | Acc]) :- !.
wrap_words_([W | Ws], Width, "", Acc, Lines) :-
    !,
    wrap_words_(Ws, Width, W, Acc, Lines).
wrap_words_([W | Ws], Width, Current, Acc, Lines) :-
    string_length(Current, L1),
    string_length(W, L2),
    Needed is L1 + 1 + L2,
    (   Needed =< Width
    ->  format(string(NewCurrent), '~w ~w', [Current, W]),
        wrap_words_(Ws, Width, NewCurrent, Acc, Lines)
    ;   wrap_words_(Ws, Width, W, [Current | Acc], Lines)
    ).


draw_info_text(X, Y, Text0, Style) :-
    gui_picture(P),
    format(string(Text), '~w', [Text0]),
    new(T, text(Text)),
    apply_text_style(T, Style),
    send(T, colour, colour(black)),
    send(P, display, T, point(X, Y)),
    assertz(info_obj(T)).


draw_clause_text(Index, X, Y, Text0, Style, Highlight) :-
    gui_picture(P),
    format(string(Text), '~w', [Text0]),
    new(T, text(Text)),
    apply_text_style(T, Style),
    (   Highlight == true
    ->  send(T, colour, colour(darkred))
    ;   send(T, colour, colour(black))
    ),
    send(P, display, T, point(X, Y)),
    (   integer(Index), Index > 0
    ->  assertz(clause_text_obj(Index, T))
    ;   assertz(clause_text_obj(0, T))
    ).


apply_text_style(T, bold) :-
    !,
    send(T, font, font(screen, bold, 13)).
apply_text_style(T, normal) :-
    !,
    send(T, font, font(screen, roman, 11)).
apply_text_style(T, font(Size)) :-
    !,
    send(T, font, font(screen, roman, Size)).
apply_text_style(T, _Other) :-
    send(T, font, font(screen, roman, 11)).


node_box_size(92, 44).

tree_pane(20, 20, 760, 500).
info_pane(800, 20, 440, 500).
clauses_pane(20, 540, 1220, 190).