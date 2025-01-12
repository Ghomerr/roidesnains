const socket = io();
let myUserId = '';
let myRoomId = '';
let myPlayer = {};
let playersList = [];
let myTurnCards = {};
let playerTurn = '';
let autoPlay = false;
let waitForPlayerSwapsHand = '';
let waitForSwapPlayers = '';
let waitForSwapCardsPlayer = '';
let playerSelectedCards = [];
let otherSelectedCards = [];
let previousFoldSelectedCards = [];
let previousFoldCards = [];
let previousFoldWinner = '';
let myFoldsCards = [];
let myFoldsCardsText = null;
let myFoldsCardsDialogWidth = 0;
let $selectCardsImg = null;
let game = 1;
let maxGame = 7;

const $headContainer = $('#head-container'),
    $footerVersion = $('#footer .version'),
    $lobbyContainer = $('.lobby-container'),
    $lobbyInpus = $('#lobby-inputs'),
    $roomPasswordLink = $('#room-password-link'),
    $roomsList = $('#rooms-list'),
    $roomsListContent = $roomsList.find('#rooms-list-content'),
    $randomRoomIdBtn = $('#random-room-id-btn'),
    $roomId = $('#room-id'),
    $userId = $('#user-id'),
    $lobbyBtn = $('#lobby-btn'),
    $infoPassword = $('#info-password'),
    $playersList = $('#players-list'),
    $playersScores = $('#players-scores'),
    $roomBanner = $('#room-banner'),
    $playerTurnLabel = $roomBanner.find('.player-turn'),
    $autoPlayBtn = $('#auto-play-btn'),
    $nextGameBtn = $('#next-game-btn'),
    $questCardContainer = $('#quest-card-container'),
    $startBtn = $('#start-btn'),
    $playerCounter = $('#players-counter'),
    $startContent = $('#start-content'),
    $questChoice = $('#quest-choice'),
    $playerCardsContainer = $('.player-cards-container'),
    $playerCards = $('#player-cards'),
    $specialCard = $('#special-card'),
    $playersCardsInCurrentTurn = $('#players-cards-in-current-turn'),
    $turnCards = $('#turn-cards'),
    $simpleDialog = $('#simple-dialog'),
    $swapHandDialog = $('#swap-hand-dialog'),
    $swapHandButtons = $swapHandDialog.find('.swap-hand-buttons button'),
    $playersSwapDialog = $('#swap-players-dialog'),
    $playersSwapButtons = $playersSwapDialog.find('.swap-players-buttons button'),
    $selectCardsDialog = $('#select-cards-dialog'),
    $selectCardsBtn = $('#select-cards-btn'),
    $selectPreviousFoldCardBtn = $('#select-prev-fold-card-btn'),
    $playerFolds = $('#player-folds'),
    $playerFoldsContainer = $playerFolds.find('.player-folds-container'),
    $playerSummaryContainer = $('#players-scores-summary'),
    $previousFoldBtn = $('#previous-fold-btn'),
    $myFoldsBtn = $('#my-folds-btn');

// Init simple dialog
$simpleDialog.dialog({
    modal: true,
    autoOpen: false,
    buttons: {
        Ok: () => {
            $simpleDialog.dialog('close');
        }
    }
});
$swapHandDialog.dialog({
    modal: true,
    autoOpen: false,
    closeOnEscape: false,
    buttons: {},
    open: () => {
        $('.ui-dialog[aria-describedby=swap-hand-dialog] .ui-dialog-titlebar-close').hide();
    }
});
$playersSwapDialog.dialog({
    modal: true,
    autoOpen: false,
    closeOnEscape: false,
    buttons: {},
    open: () => {
        $('.ui-dialog[aria-describedby=swap-players-dialog] .ui-dialog-titlebar-close').hide();
    }
});
$selectCardsDialog.dialog({
    modal: true,
    autoOpen: false,
    closeOnEscape: false,
    buttons: {},
    open: () => {
        $('.ui-dialog[aria-describedby=select-cards-dialog] .ui-dialog-titlebar-close').hide();
    }
});

$randomRoomIdBtn.click(() => {
    socket.emit('get-random-room-id');
});

// Handle lobby button click
$lobbyBtn.click(() => {
    const lobbyData = {
        userId: $userId.val(),
        roomId: $roomId.val(),
        password: $('#room-password').val()
    };
    myUserId = lobbyData.userId;
    console.log('Sending lobby event', lobbyData);
    // Send lobby event to server
    socket.emit('lobby', lobbyData);
});

// Handle click on private party link
$roomPasswordLink.click(() => {
    $roomPasswordLink.hide();
    $('#room-password-container').show();
});

// Handle start button click
$startBtn.click(() => {
    socket.emit('start-game', {
        roomId: myRoomId,
        nextGame: false
    });
});

// Handle lobby button disabled state
$('#room-id, #user-id').on('keyup change', () => {
    $lobbyBtn.prop('disabled', !$roomId.val() || !$userId.val());
});

// Handle next game button click to start a next game
$nextGameBtn.click(() => {
    socket.emit('start-game', {
        roomId: myRoomId,
        nextGame: true
    });
});

// Handle the last fold button click to display the won cards
$previousFoldBtn.click(() => {
    let previousFoldCardsText = '<div class="text-center">';
    for (const card of previousFoldCards) {
        const cardName = getCardLabel(card);
        previousFoldCardsText += '<img height="125" alt="' + cardName +
            '" src="assets/' + card.img + '" title="' + cardName + '" />';
    }
    previousFoldCardsText += '</div><br/><div class="text-center">Remportées par ' + previousFoldWinner + '</div>';
    openSimpleDialog($simpleDialog, 'Cartes du dernier pli', previousFoldCardsText);
});

// Handle the button to display the user folds 
$myFoldsBtn.click(() => {
    if (!myFoldsCardsText) {
        myFoldsCardsText = '<div class="text-center folds-cards-container">'
        for (const cards of myFoldsCards) {
            myFoldsCardsText += '<div class="fold-cards">';
            for (const card of cards) {
                const cardName = getCardLabel(card);
                myFoldsCardsText += '<img height="125" alt="' + cardName +
                    '" src="assets/' + card.img + '" title="' + cardName + '" />';
            }
            myFoldsCardsText += '</div>';
        }
        myFoldsCardsText += '</div>';
        // Compute max width of the dialog
        myFoldsCardsDialogWidth = myFoldsCards.length * 300 >= window.innerWidth ?
            Math.floor(window.innerWidth / 300) * 300 :
            myFoldsCards.length * 300;
    }
    openSimpleDialog($simpleDialog, 'Mes plis', myFoldsCardsText, myFoldsCardsDialogWidth);
});

// Handle when
$swapHandButtons.click((event) => {
    const selectedSwappedPlayer = $(event.currentTarget).attr('data-player-id');
    if (selectedSwappedPlayer && selectedSwappedPlayer !== myUserId) {
        socket.emit('swap-hand-with', {
            roomId: myRoomId,
            userId: myUserId,
            handsSwappedPlayer: waitForPlayerSwapsHand ? selectedSwappedPlayer : '',
            cardsSwappedPlayer: waitForSwapCardsPlayer ? selectedSwappedPlayer : ''
        });
    } else {
        console.log('[ERROR] Wrong or unknown player:', selectedSwappedPlayer);
    }
});
$playersSwapButtons.click((event) => {
    const swapDirection = $(event.currentTarget).attr('data-swap-dir');
    if (swapDirection) {
        socket.emit('players-swap-dir', {
            roomId: myRoomId,
            userId: myUserId,
            swapDirection: swapDirection
        });
    }
});
$selectCardsBtn.click(() => {
    socket.emit('player-chose-cards-to-swap', {
        roomId: myRoomId,
        userId: myUserId,
        playerSelectedCards: playerSelectedCards,
        otherSelectedCards: otherSelectedCards
    });
});
$selectPreviousFoldCardBtn.click(() => {
    socket.emit('player-choose-previous-fold-card', {
        roomId: myRoomId,
        userId: myUserId,
        previousFoldCard: previousFoldSelectedCards[0]
    });
});

// TEMP auto play
$autoPlayBtn.click(() => {
    autoPlay = !autoPlay;
    $autoPlayBtn.text(autoPlay ? 'Stop play' : 'Auto play');
    socket.emit('get-player-turn', myRoomId);
});
// END TEMP auto play

// Utility function to open a simple dialog
const openSimpleDialog = ($dialog, title, text, width) => {
    $dialog.dialog('option', 'title', title);
    if (width) {
        $dialog.dialog('option', 'width', width);
    } else {
        // Reset default width
        $dialog.dialog('option', 'width', 300);
    }
    $dialog.find('#dialog-text').text('').append(text);
    $dialog.dialog('open');
};

const setTurnLabel = (text) => {
    $playerTurnLabel.text('Donne ' + game + '/' + maxGame + ' - ' + text);
}

const openSwapHandDialog = ($dialog, swapHandPlayer, playerTitle, playerText, otherTitle) => {
    const $swapHandsButtons = $dialog.find('.swap-hand-buttons');
    if (swapHandPlayer === myUserId) {
        $dialog.dialog('option', 'title', playerTitle);
        $dialog.find('#swap-hand-dialog-text').text(playerText);
        for (let i = 0; i < playersList.length; i++) {
            const playerId = playersList[i];
            if (myUserId !== playerId) {
                const $swapBtn = $swapHandsButtons.find('#swap-hand-player-' + (i + 1));
                $swapBtn.attr('data-player-id', playerId);
                $swapBtn.find('span').text(playerId);
                $swapBtn.show();
            }
        }
        $swapHandsButtons.show();
    } else {
        $dialog.dialog('option', 'title', swapHandPlayer + otherTitle);
        $dialog.find('#swap-hand-dialog-text').text('Attendre pendant que ' + swapHandPlayer + ' choisit un joueur...');
        $swapHandsButtons.hide();
    }
    $dialog.dialog('open');

    if (autoPlay) {
        $swapHandDialog.find('.swap-hand-buttons button[data-player-id]:not([data-player-id=""]):first-of-type').click();
    }
};

const openPlayersSwapDialog = ($dialog, playersSwap) => {
    if (playersSwap === myUserId) {
        $dialog.dialog('option', 'title', 'Choisir une direction');
        $dialog.find('#swap-players-dialog-text').text("Choisr à quelle personne chaque joueur va donner ses cartes");
        $dialog.find('.swap-players-buttons').show();
    } else {
        $dialog.dialog('option', 'title', playersSwap + ' choisit une direction');
        $dialog.find('#swap-players-dialog-text').text('Attendre pendant que ' + playersSwap + ' choisit une direction...');
    }
    $dialog.dialog('open');
    if (autoPlay) {
        $swapHandDialog.find('.swap-players-buttons button:first-of-type').click();
    }
};

const handleClickSelectCardImg = (event) => {
    const $img = $(event.currentTarget);
    let cards = [];
    let maxCards = 0;
    let $btn = null;
    let disabled = () => true;
    switch ($img.attr('data-card-type')) {
        case 'player':
            cards = playerSelectedCards;
            maxCards = 2;
            $btn = $selectCardsBtn;
            disabled = () => playerSelectedCards.length !== maxCards || otherSelectedCards.length !== maxCards;
            break;
        case 'other':
            cards = otherSelectedCards;
            maxCards = 2;
            $btn = $selectCardsBtn;
            disabled = () => playerSelectedCards.length !== maxCards || otherSelectedCards.length !== maxCards;
            break;
        case 'previous-fold':
            cards = previousFoldSelectedCards;
            maxCards = 1;
            $btn = $selectPreviousFoldCardBtn;
            disabled = () => previousFoldSelectedCards.length !== maxCards;
            break;
    }
    if (!$img.hasClass('selected') && cards.length < maxCards) {
        cards.push($img.attr('data-card-id'));
        $img.addClass('selected');
    } else if ($img.hasClass('selected')) {
        cards.splice(cards.indexOf($img.attr('data-card-id')));
        $img.removeClass('selected');
    }
    $btn.prop('disabled', disabled);
};

const joinRoomId = (element) => {
    if ($userId.val()) {
        const $roomNameElement = $(element);
        $roomId.val($roomNameElement.data('room-id'));
        $lobbyBtn.click();
    }
};

// Display card label
const getCardLabel = (card) => {
    if (card.type === 'special') {
        return card.name;
    } else {
        return card.name + ' of ' + card.type + (!card.head && card.value != card.name ? ' (' + card.value + ')' : '');
    }
};

// Display player name or 'me'
const getPlayerLabel = (playerId) => {
    return playerId === myUserId ? 'Moi' : playerId;
};

// #3 First event received from server.js
socket.on('connected', (data) => {
    console.log('Client connected with server', data);

    // Init room id from generated server value
    const roomId = data.roomId;
    $roomId.val(roomId);
    // TEMP : fixed room id
    //$roomId.val('TEST-ROOM-0001');

    socket.emit('get-version');

    // Display rooms list
    const roomsList = data.roomsList;
    if (roomsList.length) {
        $roomsListContent.text('');
        for (const roomData of roomsList) {
            // Prepare displayed data
            const roomTooltip = roomData.status === 'lobby' ?
                'Rejoindre cette salle de jeu' :
                roomData.status === 'full-lobby' ?
                'Impossible de rejoindre une salle de jeu complète' :
                'Impossible de rejoindre une salle déjà en jeu';
            const roomIcon = roomData.status === 'lobby' ?
                'fa-sign-in-alt' :
                'fa-ban';
            const roomStatus = roomData.status === 'lobby' ? 'LOBBY' : roomData.status === 'full-lobby' ? 'COMPLÈTE' : 'EN JEU';
            // Create room line with room data
            const roomsListText = '<div class="room-line ' + roomData.status + '">' +
                '<div class="room-name" title="' + roomTooltip + '" data-room-id="' + roomData.id + '" onclick="joinRoomId(this);">' +
                '<i class="fas ' + roomIcon + ' "></i> ' +
                '<span>' + roomData.id + '</span>' +
                '</div>' +
                '<div class="room-info" title="' + roomData.usersNames + '">' + roomData.usersCount + ' joueur(s)</div>' +
                '<div class="room-status">' + roomStatus + '</div>' +
                '</div>';
            $roomsListContent.append(roomsListText);
        }
        $roomsList.show();
    }
});

// Handle display version in game title
socket.on('version', version => {
    $footerVersion.text(version);
});

// Handle change room id
socket.on('random-room-id', (roomId) => {
    $roomId.val(roomId);
});

// Handle user joined lobby
socket.on('players-list-changed', (room) => {
    console.log('User in lobby', room);
    myRoomId = room.id;
    $lobbyInpus.hide();
    $roomsList.hide();
    $playersList.show();
    $playersList.find('.room-id-title').text(room.id);
    const $lobbyPlayersList = $playersList.find('.lobby-players-list');
    $lobbyPlayersList.text('');

    // Display players in the lobby
    room.users.forEach(user => {
        let username = user.id;
        if (user.id === room.owner) {
            username = '<i class="fas fa-crown"></i>' + username;
        }
        if (user.id === myUserId) {
            username = '<strong>' + username + '</strong>';
        }
        $lobbyPlayersList.append('<div class="user">' + username + '</div>');
    });

    // Start conditions
    $playerCounter.text(room.users.length);
    if (room.owner === myUserId) {
        $startBtn.show();
        $startBtn.prop('disabled', room.users.length < 3 || room.users.length > 5);
        if (room.password) {
            $infoPassword.text('Mot de passe : ' + room.password);
            $infoPassword.show();
        }
    }
});

// Select quest event
socket.on('select-quest', (room) => {
    game = room.game;
    maxGame = room.maxGame;
    myPlayer = room.users.find(player => player.id === myUserId);
    $lobbyContainer.hide();
    $playersList.hide();
    $playerFolds.hide();
    $playerSummaryContainer.hide();
    $nextGameBtn.hide();
    $questCardContainer.hide();
    $questCardContainer.parent().css('visibility', 'hidden');

    const questChooser = room.users.find(p => p.isChosingQuest);

    // Display player scores boxes
    let playerIndex = 1;
    playersList = [];
    room.users.forEach((player) => {
        playersList.push(player.id); // save players ids

        // Init players boxes with their id
        const $playerBox = $playersScores.find('.player-box:nth-of-type(' + playerIndex++ + ')');
        if (questChooser.id === player.id) {
            $playerBox.addClass('current-player');
        } else {
            $playerBox.removeClass('current-player');
        }
        $playerBox.attr('data-player-id', player.id);
        $playerBox.find('.player-label').text(getPlayerLabel(player.id));

        // Reset folds
        const $playerFolds = $playerBox.find('.player-folds span');
        $playerFolds.text('0');

        $playerBox.show();
    });
    $playersScores.show();

    // Display room banner with player turn and room id
    $roomBanner.find('.room-id-title').text('Room ' + room.id);

    // Add in game class to change header disposition
    $headContainer.addClass('in-game');

    // Display current quest
    const questTileName = room.questTile.quests[0].name + '\nOU\n' + room.questTile.quests[1].name;
    const $questTileContainer = $questChoice.find('div#quest-tile');
    $questTileContainer.text('');
    $questTileContainer.append('<img height="200" alt="' + questTileName +
        '" src="assets/' + room.questTile.img + '" title="' + questTileName + '" />');
    $questChoice.show();

    const $questBtn = $questChoice.find('#quest-select-btn');
    if (myPlayer.isChosingQuest) {
        setTurnLabel('Choix de la quête');

        // Display quest select buttons for the player who choses the quest
        $questBtn.show();
        $questBtn.find('#quest-1').val(room.questTile.quests[0].name);
        $questBtn.find('#quest-2').val(room.questTile.quests[1].name);
        $questBtn.find('input').click((event) => {
            // Dispatch which quest is choosen
            socket.emit('choose-quest', {
                userId: myUserId,
                roomId: myRoomId,
                quest: event.target.id === 'quest-1' ? 0 : 1
            });
        });
    } else {
        // Display what player is choosing the quest
        setTurnLabel(questChooser.id + ' choisit la quête');
        $questBtn.hide();
    }
    $roomBanner.show();

    // Special card display
    const specialCardName = getCardLabel(room.specialCard);
    const $specialCardContainer = $specialCard.find('.special-card-container');
    $specialCardContainer.text('');
    $specialCardContainer.append('<img height="250" alt="' + specialCardName +
        '" src="assets/' + room.specialCard.img + '" title="' + specialCardName + '" />' +
        '<div class="special-card-details"></div>');
    $specialCard.show();

    $playerCards.hide();
    socket.emit('get-player-cards', {
        roomId: myRoomId,
        userId: myUserId
    });
});

// Handle when the server refresh player cards
socket.on('player-cards', (player) => {
    myPlayer = player;

    // Player's cards and title
    $playerCardsContainer.find('img').off('click');
    $playerCardsContainer.text('');
    for (const card of myPlayer.cards) {
        const cardName = getCardLabel(card);
        const canBePlayed = card.canBePlayed ? 'can-be-played' : card.canBePlayed === false ? 'cannot-be-played' : '';
        $playerCardsContainer.append('<div class="' + canBePlayed +
            '"><img class="' + canBePlayed + '" height="250" id="card-' +
            card.id + '" data-card-id="' + card.id + '" alt="' + cardName +
            '" src="assets/' + card.img + '" title="' + cardName + '" /></div>');
    }
    $playerCards.show();

    // Bind click cards event
    $playerCardsContainer.find('img').click((event) => {
        const cardEl = $(event.target);
        if (playerTurn === myUserId || cardEl.hasClass('can-be-played')) {
            playerTurn = null;
            // Add event to play a card
            const cardId = cardEl.data('card-id');
            socket.emit('play-card', {
                roomId: myRoomId,
                userId: myUserId,
                cardId: cardId
            });
        } else {
            openSimpleDialog($simpleDialog, 'Attention', 'Attend ton tour !');
        }
    });
});

// Handle when the quest has been chosen
socket.on('quest-chosen', (room) => {
    $specialCard.hide();
    $questChoice.hide();

    // Show selected quest in header
    const questTileName = room.currentQuest.name;
    $questCardContainer.text('');
    $questCardContainer.append('<img height="200" alt="' + questTileName +
        '" src="assets/' + room.questTile.img + '" title="' + questTileName + '" />');
    $questCardContainer.removeClass('quest-id-0 quest-id-1');
    $questCardContainer.addClass('quest-id-' + room.currentQuest.id);
    $questCardContainer.show();
    $questCardContainer.parent().css('visibility', 'visible');

    // Display first player to play
    socket.emit('get-player-turn', myRoomId);

    // TEMP : display auto play button
    $autoPlayBtn.show();
    // END TEMP auto play
});

// Handle when the player turn changed
socket.on('player-turn', (playerTurnId) => {
    playerTurn = playerTurnId;

    // Display player turn
    if (playerTurnId) {
        setTurnLabel(playerTurn === myUserId ? 'Mon tour !' : 'Tour de ' + playerTurnId)
        $playersCardsInCurrentTurn.show();

        // Add or remove current player class on player box
        for (let i = 1; i <= 5; i++) {
            const playerBox = $playersScores.find('.player-box:nth-of-type(' + i + ')');
            if (playerBox.data('player-id') === playerTurn) {
                playerBox.addClass('current-player');
            } else {
                playerBox.removeClass('current-player');
            }
        }
    }

    // Add or remove current player class on player cards
    if (playerTurn === myUserId) {
        $playerCards.addClass('current-player');
        // TEMP auto play
        if (autoPlay) {
            const firstCard = myTurnCards.length ? myTurnCards[0] : null;
            const autoCard =
                myPlayer.cards.find(c => !firstCard || c.type === firstCard.type || (c.type === 'special' && c.name !== 'wizard')) || myPlayer.cards[0];
            socket.emit('play-card', {
                roomId: myRoomId,
                userId: myUserId,
                cardId: autoCard.id
            });
        }
        // END TEMP auto play
    } else {
        $playerCards.removeClass('current-player');
    }
});

// Handle when player makes an error
socket.on('player-error', (error) => {
    switch (error.type) {
        case 'maximum-rooms-count':
            openSimpleDialog($simpleDialog, 'Erreur', 'Le nombre de rooms maximum a été atteint : ' + error.data);
            break;
        case 'player-already-exists':
            openSimpleDialog($simpleDialog, 'Erreur', 'Le nom de joueur choisi est déjà pris dans cette room : ' + error.data);
            break;
        case 'already-in-game':
            openSimpleDialog($simpleDialog, 'Erreur', 'Vous ne pouvez pas rejoindre une partie déjà en cours !');
            break;
        case 'full-lobby':
            openSimpleDialog($simpleDialog, 'Erreur', 'Vous ne pouvez pas rejoindre la salle de jeu ' + error.data + ', car elle est déjà complète.');
            break;
        case 'password-error':
            openSimpleDialog($simpleDialog, 'Erreur', 'Le mot de passe de la Salle de jeu ' + error.data + ' est incorrect.');
            break;
        case 'wrong-type':
            openSimpleDialog($simpleDialog, 'Attention', 'Vous devez jouer une carte ' + error.data + ' !');
            break;
        case 'cannot-play-this-card':
            openSimpleDialog($simpleDialog, 'Attention', 'Vous ne pouvez pas jouer cette carte : ' + error.data);
            break;
        default:
            openSimpleDialog($simpleDialog, 'Erreur!', 'Erreur inconnue: ' + error.type + ' ' + error.data);
    }
})

// Handle current played cards list
socket.on('played-cards', (room) => {
    myTurnCards = room.turnCards;
    $turnCards.text('');
    for (const card of myTurnCards) {
        const cardName = getCardLabel(card);
        $turnCards.append('<div class="played-card-container"><img height="250" alt="' +
            cardName + '" src="assets/' + card.img + '" title="' + cardName +
            '" /><div class="player-name">' +
            (card.player === myUserId ? '<strong>Ma carte</strong>' : card.player) +
            '</div></div>');
    }
    $turnCards.show();
});

// Handle new turn
socket.on('player-won-fold', (data) => {
    $previousFoldBtn.show();
    previousFoldWinner = data.winnerId;
    previousFoldCards = data.previousFoldCards;
    // Add user fold cards
    if (data.winnerId === myUserId) {
        if (myFoldsCards.length === 0) {
            $myFoldsBtn.show();
        }
        myFoldsCards.push(data.foldCards);
        myFoldsCardsText = null; // force the text to be rebuilt
    }

    $simpleDialog.on('dialogclose', () => {
        $turnCards.hide();
        socket.emit('get-played-cards', myRoomId);
        socket.emit('get-player-cards', {
            roomId: myRoomId,
            userId: myUserId
        });
        socket.emit('get-player-turn', myRoomId);

        // Update player folds number
        const $playerFolds = $playersScores.find('.player-box[data-player-id=' + previousFoldWinner + '] .player-folds span');
        $playerFolds.text(+$playerFolds.text() + 1);

        $simpleDialog.off('dialogclose');

        // Handle if a player has to swap his/her hand with another one
        if (waitForPlayerSwapsHand) {
            openSwapHandDialog($swapHandDialog, waitForPlayerSwapsHand,
                'Echanger ma main', 'Choisir un joueur',
                ' échange sa main');
        }
        if (waitForSwapPlayers) {
            openPlayersSwapDialog($playersSwapDialog, waitForSwapPlayers);
        }
    });
    openSimpleDialog($simpleDialog, 'Fin du tour', (previousFoldWinner === myUserId ? 'Je' : previousFoldWinner) + ' remporte le pli !');
    // TEMP auto play
    if (autoPlay) {
        $simpleDialog.dialog('close');
    }
    // END TEMP auto play
});

// Handle when a player has to swap his/her hands
socket.on('player-swap-hand', (playerSwapper) => {
    waitForPlayerSwapsHand = playerSwapper;
});

socket.on('swap-players-direction', (playerSwapper) => {
    waitForSwapPlayers = playerSwapper;
});

socket.on('player-swapped-cards', (swappedPlayer) => {
    $swapHandDialog.dialog('close');
    $simpleDialog.on('dialogclose', () => {
        socket.emit('get-player-cards', {
            roomId: myRoomId,
            userId: myUserId
        });
        if (autoPlay) {
            socket.emit('get-player-turn', myRoomId);
        }
    });
    openSimpleDialog($simpleDialog, 'Cartes échangées',
        (waitForPlayerSwapsHand === myUserId ? 'Mes cartes' : 'Les cartes de ' + waitForPlayerSwapsHand) +
        ' ont été échangées avec ' + (swappedPlayer === myUserId ? 'les miennes' : 'celles de ' + swappedPlayer));
    if (autoPlay) {
        $simpleDialog.dialog('close');
    }
    waitForPlayerSwapsHand = '';
});

socket.on('players-cards-swapped', (swapDir) => {
    $playersSwapDialog.dialog('close');
    $simpleDialog.on('dialogclose', () => {
        socket.emit('get-player-cards', {
            roomId: myRoomId,
            userId: myUserId
        });
        if (autoPlay) {
            socket.emit('get-player-turn', myRoomId);
        }
    });
    openSimpleDialog($simpleDialog, 'Cartes échangées',
        'Mes cartes ont été échangées avec celles de la personne à ' + (swapDir === 'left' ? 'gauche' : 'droite'));
    if (autoPlay) {
        $simpleDialog.dialog('close');
    }
    waitForSwapPlayers = '';
});

socket.on('player-choose-other-to-swap', (playerSwapCards) => {
    waitForSwapCardsPlayer = playerSwapCards;
    openSwapHandDialog($swapHandDialog, waitForSwapCardsPlayer,
        'Echanger 2 cartes', 'Choisir un joueur',
        ' échange 2 cartes');
});

socket.on('select-cards-to-swap', (data) => {
    $swapHandDialog.dialog('close');
    $selectCardsDialog.dialog('option', 'title', 'Choisir 2 cartes');
    $selectCardsDialog.dialog('option', 'width', (data.playerCards.length + 1) * 70);
    $selectCardsDialog.find('#select-card-dialog-text')
        .text('Choisir 2 cartes de ma main à échanger avec 2 cartes de ' + data.other);
    let playerCardsTxt = '';
    for (const card of data.playerCards) {
        const cardName = getCardLabel(card);
        playerCardsTxt += '<img height="125" data-card-id="' + card.id +
            '" data-card-type="player" alt="' + cardName +
            '" src="assets/' + card.img + '" title="' + cardName + '" />';
    }
    let otherCardsTxt = '';
    for (const card of data.otherCards) {
        otherCardsTxt += '<img height="125" data-card-id="' + card.id +
            '" data-card-type="other" src="assets/carte_back.png" />';
    }
    $selectCardsDialog.find('#select-cards').text('').append(playerCardsTxt).show();
    $selectCardsDialog.find('#select-other-cards').text('').append(otherCardsTxt).show();
    $selectCardsBtn.show();
    $selectPreviousFoldCardBtn.hide();
    $selectCardsImg = $('#select-cards img, #select-other-cards img');
    $selectCardsImg.click(handleClickSelectCardImg);

    playerSelectedCards = [];
    otherSelectedCards = [];

    $selectCardsDialog.dialog('open');
});

socket.on('get-previous-fold-card', (data) => {
    if (data.playerId === myUserId) {
        $selectCardsDialog.dialog('option', 'title', 'Choisir 1 carte');
        $selectCardsDialog.dialog('option', 'width', (data.lastFoldCards.length + 1) * 70);
        $selectCardsDialog.find('#select-card-dialog-text')
            .text('Choisir 1 carte du dernier pli à échanger avec le Sorcier');

        let cardsTxt = '';
        for (const card of data.lastFoldCards) {
            const cardName = getCardLabel(card);
            cardsTxt += '<img height="125" data-card-id="' + card.id +
                '" data-card-type="previous-fold" alt="' + cardName +
                '" src="assets/' + card.img + '" title="' + cardName + '" />';
        }
        $selectCardsDialog.find('#select-cards').text('').append(cardsTxt).show();
        $selectCardsDialog.find('#select-other-cards').text('').hide();
        $selectCardsBtn.hide();
        $selectPreviousFoldCardBtn.show();
        $selectCardsImg = $('#select-cards img');
        $selectCardsImg.click(handleClickSelectCardImg);

        previousFoldCard = null;

    } else {
        $selectCardsDialog.dialog('option', 'title', data.playerId + ' choisit une carte');
        $selectCardsDialog.find('#select-card-dialog-text')
            .text('Attendre pendant que ' + data.playerId + ' choisit une carte dans le pli précédent...');
        $selectCardsBtn.hide();
        $selectPreviousFoldCardBtn.hide();
    }

    $selectCardsDialog.dialog('open');
});

socket.on('players-swapped-cards', (data) => {
    $swapHandDialog.dialog('close'); // Close swap hand dialog for waiting players
    $selectCardsDialog.dialog('close'); // Close select cards dialog for the author of the event
    $selectCardsDialog.find('#select-cards').hide();
    $selectCardsDialog.find('#select-other-cards').hide();

    let cardGiver = data.playerId === myUserId ? data.otherId : data.otherId === myUserId ? data.playerId : '';
    let cardsGiven = data.playerId === myUserId ? data.otherCards : data.otherId === myUserId ? data.playerCards : [];
    let pluralForm = data.playerCards.length > 1 ? 's' : '';

    if (cardGiver && cardsGiven.length) {
        // Display swapped cards
        $simpleDialog.dialog('option', 'title', 'Carte' + pluralForm + ' reçue' + pluralForm);
        let cardsTxt = '<div class="text-center">';
        for (const card of cardsGiven) {
            const cardName = getCardLabel(card);
            cardsTxt += '<img height="125" alt="' + cardName +
                '" src="assets/' + card.img + '" title="' + cardName + '" />';
        }
        cardsTxt += '</div>'
        $simpleDialog.find('#dialog-text').text('').append(cardsTxt);
        $simpleDialog.dialog('open');
    } else {
        // Other players not involved are only notified in summary
        $simpleDialog.dialog('option', 'title', 'Carte' + pluralForm + ' échangée' + pluralForm);
        $simpleDialog.find('#dialog-text').text(data.playerId +
            ' a échangé ' + data.playerCards.length + ' carte' +
            pluralForm +
            ' avec ' + data.otherId);
        $simpleDialog.dialog('open');
    }

    // Update last fold and my folds data
    if (data.updatePreviousFold) {
        let swappedCardIndex = previousFoldCards.findIndex(c => c.id === data.updatePreviousFold.swapedCard);
        previousFoldCards.splice(swappedCardIndex, 1, data.updatePreviousFold.wizardCard);
        // If the other player whose the card has been swapped, update its last fold cards too
        if (data.updatePreviousFold.other === myUserId) {
            const userLastFold = myFoldsCards[myFoldsCards.length - 1];
            swappedCardIndex = userLastFold.findIndex(c => c.id === data.updatePreviousFold.swapedCard);
            userLastFold.splice(swappedCardIndex, 1, data.updatePreviousFold.wizardCard);
            myFoldsCardsText = null;
        }
    }

    $simpleDialog.on('dialogclose', () => {
        socket.emit('get-player-cards', {
            roomId: myRoomId,
            userId: myUserId
        });
        socket.emit('get-player-turn', myRoomId);
    });
});

// Handle end of a game to display the player folds and score
socket.on('display-folds-score', (room) => {
    $previousFoldBtn.hide();
    $myFoldsBtn.hide();
    $playersCardsInCurrentTurn.hide();
    $playerCards.hide();
    $autoPlayBtn.hide();
    $autoPlayBtn.text('Auto play');
    autoPlay = false;

    // Display game summary
    for (let i = 1; i <= room.users.length; i++) {
        const $playerSummary = $playerSummaryContainer.find('.player-summary:nth-of-type(' + i + ')');
        const player = room.users[i - 1];
        $playerSummary.find('.player-label').text(getPlayerLabel(player.id));
        const deltaScore = (+player.score - +player.previousScore);
        $playerSummary.find('.player-prev-score').text(player.previousScore);
        $playerSummary.find('.player-delta-score').text(deltaScore >= 0 ? ' +' + deltaScore : deltaScore)
            .addClass(deltaScore > 0 ? 'positive' : deltaScore < 0 ? 'negative' : '')
            .removeClass(deltaScore >= 0 ? 'negative' : deltaScore <= 0 ? 'positive' : '');
        $playerSummary.find('.player-score').text((player.score >= 0 ? '+' : '') + player.score)
            .addClass(player.score > 0 ? 'positive' : player.score < 0 ? 'negative' : '')
            .removeClass(player.score >= 0 ? 'negative' : player.score <= 0 ? 'positive' : '');

        if (player.id === myUserId) {
            $playerSummary.addClass('current-player');
        } else {
            $playerSummary.removeClass('current-player');
        }
        $playerSummary.show();
    }

    // Display special card details

    let specialCardDetailsText = '<ul><li>Jouée par: ' + getPlayerLabel(room.specialCard.player) +
        '</li><li>Remportée par: ' + getPlayerLabel(room.specialCard.winner) + '</li>';
    if (room.specialCard.copy) {
        specialCardDetailsText += '<li>A copié: ' + getCardLabel(room.specialCard.copy) + '</li>'
    }
    if (room.specialCard.swap) {
        specialCardDetailsText += '<li>A échangé: ' + getCardLabel(room.specialCard.swap) + '</li>'
    }
    specialCardDetailsText += '</ul>';
    $('.special-card-details').text('').append(specialCardDetailsText);
    $specialCard.show();
    $playerSummaryContainer.show();

    // Display player folds and scores
    $playerFoldsContainer.text('');
    const player = room.users.find(p => p.id === myUserId);
    if (player.folds.length > 0) {
        for (const fold of player.folds) {
            const foldScoreStyle = fold.score > 0 ? 'positive' : fold.score < 0 ? 'negative' : '';
            let foldText = '<div class="fold-container ' + foldScoreStyle + '" data-fold-order="' + (fold.order + 1) + '">';
            for (const card of fold.cards) {
                const cardName = getCardLabel(card);
                const cardScoreStyle = card.score > 0 ? 'positive' : card.score < 0 ? 'negative' : '';
                foldText += '<div class="fold-card-container ' + cardScoreStyle + '"><img height="250" alt="' +
                    cardName + '" src="assets/' + card.img + '" title="Jouée par ' + (getPlayerLabel(card.player)) + '" alt="' + cardName + '" />' +
                    (card.score !== 0 ? '<div class="card-score">Carte: ' + (card.score > 0 ? '+' : '') + card.score + '</div>' : '') +
                    '</div>';
            }
            foldText += fold.score !== 0 ?
                '<div>Pli #' + (fold.order + 1) + ': ' + (fold.score > 0 ? '+' : '') + fold.score + '</div></div>' : '';
            $playerFoldsContainer.append(foldText);
        }
    } else {
        $playerFoldsContainer.append('Pas de plis sur cette donne');
    }
    $playerFolds.show();

    // Update players scores in the header
    for (const p of room.users) {
        const $playerBox = $playersScores.find('.player-box[data-player-id=' + p.id + ']');
        $playerBox.find('.player-score span').text(p.score);

        // Display current-player style for the one who is the next game starter
        if (p.isNextGameStarter) {
            $playerBox.addClass('current-player');
        } else {
            $playerBox.removeClass('current-player');
        }
    }

    let endGameText = room.game < maxGame ? 'Fin de la donne' : 'Fin de la partie';
    // Display the next game button for the player who won the 5 of dwarf
    if (room.game < maxGame) {
        if (player.isNextGameStarter) {
            $nextGameBtn.show();
        } else {
            const nextGameStarter = room.users.find(p => p.isNextGameStarter);
            endGameText += ', ' + nextGameStarter.id + ' peut relancer...';
        }
    }

    // Show end game modal
    if (room.game === maxGame) {
        const winner = room.users.reduce((u1, u2) => {
            return u1.score > u2.score ? u1 : u2;
        });
        console.log('winner', winner);
        const winners = room.users.filter(u => u.score === winner.score).map(u => u.id);
        if (winners.length === 1) {
            openSimpleDialog($simpleDialog, endGameText, winner.id + ' a gagné la partie avec un score de ' + winner.score);
        } else {
            openSimpleDialog($simpleDialog, endGameText, winners.join(', ') + ' ont gagné la partie ex aequo avec un score de ' + winner.score);
        }
    }
    // Display end of current game label
    setTurnLabel(endGameText);
});

// Handle when a player can play a card while it's not their turn
socket.on('card-can-be-played', (specialCard) => {
    if (specialCard.player === myUserId) {
        const card = $('img#card-' + specialCard.id);
        if (specialCard.canBePlayed) {
            card.removeClass('cannot-be-played');
            card.parent().removeClass('cannot-be-played');
            card.addClass('can-be-played');
            card.parent().addClass('can-be-played');
        } else {
            card.addClass('cannot-be-played');
            card.parent().addClass('cannot-be-played');
            card.removeClass('can-be-played');
            card.parent().removeClass('can-be-played');
        }
    }
});