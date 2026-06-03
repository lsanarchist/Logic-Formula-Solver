tokenize(Input, Tokens) :-
    atom_chars(Input, Chars),
    catch(
        tokenize_chars(Chars, Tokens),
        error(tokenize_error(Msg)),
        (format("Tokenize error: ~w~n", [Msg]), fail)
    ).

tokenize_chars([], []) :- !.

% space
tokenize_chars([' '|Rest], Tokens) :- !,
    tokenize_chars(Rest, Tokens).

% escaped LaTeX commands
tokenize_chars(['\\','L','e','f','t','r','i','g','h','t','a','r','r','o','w'|Rest], [iff|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).
tokenize_chars(['\\','R','i','g','h','t','a','r','r','o','w'|Rest], [imp|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).
tokenize_chars(['\\','l','o','r'|Rest], [or|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).
tokenize_chars(['\\','l','a','n','d'|Rest], [and|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).
tokenize_chars(['\\','n','e','g'|Rest], [not|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).
tokenize_chars(['\\','f','o','r','a','l','l'|Rest], [forall|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).
tokenize_chars(['\\','e','x','i','s','t','s'|Rest], [exists|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).

% multi-symbol tokens
% ->
tokenize_chars(['-','>'|Rest], [imp|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).

% <->
tokenize_chars(['<','-','>'|Rest], [iff|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).

% /\
tokenize_chars(['/','\\'|Rest], [and|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).

% \/
tokenize_chars(['\\','/'|Rest], [or|Tokens]) :- !,
    tokenize_chars(Rest, Tokens).

% one-symbol token
tokenize_chars(['('|Rest], [lparen|Tokens]) :- !, tokenize_chars(Rest, Tokens).
tokenize_chars([')'|Rest], [rparen|Tokens]) :- !, tokenize_chars(Rest, Tokens).
tokenize_chars([','|Rest], [comma|Tokens])  :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['.'|Rest], [dot|Tokens])    :- !,  tokenize_chars(Rest, Tokens).
tokenize_chars(['~'|Rest], [not|Tokens])    :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['&'|Rest], [and|Tokens])    :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['|'|Rest], [or|Tokens])     :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['∨'|Rest], [or|Tokens])     :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['∧'|Rest], [and|Tokens])    :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['¬'|Rest], [not|Tokens])    :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['⇒'|Rest], [imp|Tokens])    :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['⇔'|Rest], [iff|Tokens])    :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['∀'|Rest], [forall|Tokens])  :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['∃'|Rest], [exists|Tokens])  :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['⊤'|Rest], [true|Tokens])    :- !, tokenize_chars(Rest, Tokens).
tokenize_chars(['⊥'|Rest], [false|Tokens])   :- !, tokenize_chars(Rest, Tokens).

% keyword or var
tokenize_chars([C|Rest], [Token|Tokens]) :-
    identifier_start(C), !,
    collect_word([C|Rest], WordChars, Remaining),
    word_to_token(WordChars, Token),
    tokenize_chars(Remaining, Tokens).

% unknown symbol
tokenize_chars([C|_], _) :-
    format(atom(Msg), 'Unknown character: ~w', [C]),
    throw(error(tokenize_error(Msg))).

identifier_start(C) :-
    char_type(C, alpha), !.
identifier_start('_').

identifier_char(C) :-
    char_type(C, alnum), !.
identifier_char('_').

collect_word([C|Rest], [C|WordChars], Remaining) :-
    identifier_char(C), !,
    collect_word(Rest, WordChars, Remaining).
collect_word(Rest, [], Rest).

word_to_token(Chars, Token) :-
    atom_chars(Atom, Chars),
    keyword(Atom, Token), !.
word_to_token(Chars, var(Atom)) :-
    atom_chars(Atom, Chars).

keyword(forall, forall).
keyword(exists, exists).
keyword(or,  or).
keyword(and, and).
keyword(not, not).
keyword(imp, imp).
keyword(iff, iff).
keyword(true, true).
keyword(false, false).
