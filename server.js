const express = require("express");
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// Load scripts
const utils = require('./utils.js');

// Load data
const cards = require('./cards.json');
const specialCards = require('./cards-specials.json');
const tiles = require('./tiles.json');
const package = require('./package.json');

// Consts
const MAX_ROOMS = 10;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 5;

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '.') + '/main.html');
});

app.use(express.static(path.resolve(__dirname, '.')));

// Sockets handle
const sockets = {};

// Server rooms
const rooms = {};
let roomsCount = 0;

// #1 First socket.io native event from client.js
io.on('connection', (socket) => {
    console.log('New player on the main page.', socket.id);

    // Prepare rooms list data
    const roomsList = [];
    for (const [id, room] of Object.entries(rooms)) {
        roomsList.push({
            id: id,
            status: room.status,
            usersCount: room.users.length,
            usersNames: room.users.map(u => u.id).join(', ')
        })
    }

    socket.emit('connected', {
        roomId: utils.randomRoomId(),
        roomsList: roomsList
    });

    // Handle when player asks a room id
    socket.on('get-random-room-id', () => {
        // #2 Send first response to client : random room id
        socket.emit('random-room-id', utils.randomRoomId());
    });

    // Handle get version
    socket.on('get-version', () => {
        socket.emit('version', package.name + ' v' + package.version);
    });

    // Handle user entering the lobby
    socket.on('lobby', (data) => {
        console.log('Entering lobby request', socket.id, data);

        // Save socket id
        sockets[socket.id] = {
            userId: data.userId,
            roomId: data.roomId
        };

        // New room init
        if (!rooms.hasOwnProperty(data.roomId)) {
            if (roomsCount < MAX_ROOMS) {
                rooms[data.roomId] = {
                    id: data.roomId,
                    status: 'lobby',
                    owner: data.userId,
                    password: data.password,
                    users: [],
                    specials: [],
                    specialCard: {},
                    tiles: [],
                    questTile: {},
                    currentQuest: {},
                    playerTurn: '',
                    turn: 0,
                    turnCards: [],
                    turnType: '',
                    turnsNumber: 0,
                    nextFoldScore: 0,
                    playerSwapCards: '',
                    cardsSwappedPlayer: '',
                    lastFoldWinner: '',
                    game: 1,
                    maxGame: 7
                };
                roomsCount++;
            } else {
                socket.emit('player-error', {
                    type: 'maximum-rooms-count',
                    data: MAX_ROOMS
                });
                return;
            }
        }

        const room = rooms[data.roomId];
        if (room.status === 'lobby') {
            if (room.users.length < MAX_PLAYERS) {
                if (!room.password || data.password === room.password) {
                    // If no user exists with this id
                    if (!room.users.some(u => u.id === data.userId)) {
                        room.users.push({
                            id: data.userId,
                            cards: [],
                            score: 0,
                            previousScore: 0,
                            scoreFactor: 1,
                            isChosingQuest: false,
                            isFirstPlayer: false,
                            isNextGameStarter: false,
                            folds: []
                        });
                        socket.join(data.roomId);
                        if (room.users.length === MAX_PLAYERS) room.status = 'full-lobby';
                        io.to(data.roomId).emit('players-list-changed', room);
                    } else {
                        socket.emit('player-error', {
                            type: 'player-already-exists',
                            data: data.userId
                        });
                    }
                } else {
                    socket.emit('player-error', {
                        type: 'password-error',
                        data: data.roomId
                    });
                }
            } else {
                socket.emit('player-error', {
                    type: 'full-lobby',
                    data: data.roomId
                });
            }
        } else {
            socket.emit('player-error', {
                type: 'already-in-game'
            });
        }
    });

    // Handle start game
    socket.on('start-game', (data) => {
        const room = rooms[data.roomId];
        if (room && room.users.length >= MIN_PLAYERS && room.users.length <= MAX_PLAYERS) {
            room.status = 'in-game';

            // Handle game reset for a next game
            if (data.nextGame) {
                room.game++;
                room.turn = 0;
                room.turnCards = [];
                room.playerSwapCards = '';
                room.cardsSwappedPlayer = '';
                room.lastFoldWinner = '';
                for (const player of room.users) {
                    player.isNextGameStarter = false;
                    player.isChosingQuest = false;
                    player.isFirstPlayer = false;
                    player.cards = [];
                    player.folds = [];
                    player.previousScore = player.score;
                    player.scoreFactor = 1;
                }
            } else {
                // Suffle special cards
                room.specials = utils.shuffle([...specialCards]);
                // Shuffle quest tiles
                room.tiles = utils.shuffle([...tiles]);
            }

            // Take one quest tile
            room.questTile = room.tiles.pop();
            /*
            room.questTile = {
                "img": "tuile16.png",
                "quests": [{
                    "code": "16-1",
                    "name": "3 p'tits tours et puis s'en va",
                    "score": "folds.length==3:+5"
                }, {
                    "code": "16-2",
                    "name": "Il ne peut en rester qu'un",
                    "score": "folds.length==1:+5"
                }]
            };
            //*/

            // Take one special card
            //room.specialCard = room.specials.pop();
            //*
            room.specialCard = {
                "id": 53,
                "value": 0,
                "name": "wizard",
                "head": false,
                "special": true,
                "type": "special",
                "img": "carte_speciale_sorcier.png",
                "effect": "get-previous-fold-card"
            };
            //*/

            // PREPARE GAME CARDS
            let gameCards = [...cards];
            // remove 2 of dwarf (first card) for 3 players
            if (room.users.length === MIN_PLAYERS) {
                gameCards.splice(0, 1);
            }
            gameCards.push(room.specialCard);
            gameCards = utils.shuffle(gameCards);

            // DISPATCH CARDS TO PLAYERS
            let playerIndex = 0;
            for (const card of gameCards) {
                const player = room.users[playerIndex++];
                player.cards.push(card);
                if (playerIndex >= room.users.length) {
                    playerIndex = 0;
                }
                // Cards with start effects
                if (card.value === 5) {
                    switch (card.type) {
                        case 'goblin':
                            player.isFirstPlayer = true;
                            room.playerTurn = player.id;
                            break;
                        case 'knight':
                            player.isChosingQuest = true;
                            break;
                    }
                } else if (card.value === 11 && card.type === 'goblin' && card.index === 2) {
                    room.playerSwapCards = player.id;
                }
            }
            // Sort player cards
            for (const player of room.users) {
                utils.sortPlayerCards(player.cards);
            }

            // Number of turns to do is the number of cards
            room.turnsNumber = room.users[0].cards.length - 1;

            // Send event
            io.to(data.roomId).emit('select-quest', room);
        }
    });

    // Handle when the quest chooser select a quest
    socket.on('choose-quest', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            const player = room.users.find(player => player.id === data.userId);
            if (room.playerSwapCards) {
                io.to(data.roomId).emit('player-choose-other-to-swap', room.playerSwapCards);
            }
            if (player && player.isChosingQuest) {
                room.currentQuest = room.questTile.quests[data.quest];
                room.currentQuest.id = data.quest;
                io.to(data.roomId).emit('quest-chosen', room);
            }
        } else {
            console.log('[ERROR] Unknown roomId', data);
        }
    });

    // Handle when a player requests his/her cards
    socket.on('get-player-cards', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            const player = room.users.find(u => u.id === data.userId);
            if (player) {
                socket.emit('player-cards', player);
            }
        }
    });

    // Handle when a player requests which player turn it is
    socket.on('get-player-turn', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            // End of game, display folds
            if (!room.playerTurn) {
                // Notify player
                socket.emit('display-folds-score', room);
            }
            socket.emit('player-turn', room.playerTurn);
        }
    });

    // Handle when a player requests which player turn it is
    socket.on('get-played-cards', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            socket.emit('played-cards', room);
        }
    });

    // Handle player plays a card
    socket.on('play-card', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            const player = room.users.find(u => u.id === data.userId);
            if (player) {
                // Search card index
                let cardIndex = utils.findIndexById(player.cards, data.cardId);
                // Remove card
                if (cardIndex > -1) {
                    // Get the played card
                    const playedCard = player.cards[cardIndex];

                    // Handle Doppleganger effect
                    if (playedCard.effect === 'copy') {
                        if (!utils.copyPreviousCardType({
                                card: playedCard,
                                turnCards: playedCard.name === 'doppleganger' ? room.turnCards : [],
                                lastWinner: room.users.find(p => p.id === room.lastFoldWinner),
                                getHighestCard: playedCard.name === 'mummy'
                            })) {
                            // If the copy cannot be done, the player cannot player this card now
                            socket.emit('player-error', {
                                type: 'cannot-play-this-card',
                                data: playedCard.name
                            });
                            // Player must still play
                            socket.emit('player-turn', room.playerTurn);
                            return;
                        }
                    }
                    // Handle Wizard effect
                    else if (playedCard.effect === 'get-previous-fold-card') {
                        // If no card has been played yet and it's not the first turn
                        // The player can select a card from the previous fold
                        if (room.turnCards.length === 0 && room.turn > 0) {
                            // Notify players that the current player will get a previous fold card
                            io.to(data.roomId).emit('get-previous-fold-card', {
                                playerId: player.id,
                                lastFoldCards: utils.getLastFoldCards(room)
                            });
                            return;
                        } else if (room.turn < room.turnsNumber) {
                            // If the wizard cannot be player, notify the player
                            // The wizard can only be player on the last turn, but does nothing
                            socket.emit('player-error', {
                                type: 'cannot-play-this-card',
                                data: playedCard.name
                            });
                            // Player must still play
                            socket.emit('player-turn', room.playerTurn);
                            return;
                        }
                    }

                    // Only normal cards set the turn type for decide which player'll won the next fold
                    if (!room.turnType && playedCard.type !== 'special') {
                        room.turnType = playedCard.type;
                    }

                    // check if the player can play this card when it's the wrong turn type
                    if (room.turnCards.length) {
                        const playerHasSameCardType = player.cards.some(card => card.type === room.turnType);
                        if (playedCard.name !== 'dragon' && playedCard.type !== room.turnType && playerHasSameCardType) {
                            // Notify player
                            socket.emit('player-error', {
                                type: 'wrong-type',
                                data: room.turnType
                            });
                            // Player must still play
                            socket.emit('player-turn', room.playerTurn);
                            return;
                        }
                    } else {
                        if (player.cards.length > 1 && playedCard.name === 'atout') {
                            // Notify player : this card cannot be the first one played on the turn
                            // but only if it's the last card in the player's hand
                            socket.emit('player-error', {
                                type: 'cannot-play-this-card',
                                data: playedCard.name
                            });
                            // Player must still play
                            socket.emit('player-turn', room.playerTurn);
                            return;
                        }
                    }

                    // If the special card is the wizard, notify the player the card cannot be played anymore
                    // But it's the last turn
                    if (room.specialCard.name === 'wizard') {
                        const canBePlayed = room.turn === room.turnsNumber;
                        if (canBePlayed !== room.specialCard.canBePlayed) {
                            room.specialCard.canBePlayed = canBePlayed;
                            io.to(data.roomId).emit('card-can-be-played', room.specialCard);
                        }
                    }

                    // Remove played card from player hand
                    player.cards.splice(cardIndex, 1);
                    // Send update to the player
                    socket.emit('player-cards', player);
                    // Save which player played this card
                    playedCard.player = player.id;
                    playedCard.score = 0;
                    playedCard.turn = room.turn;

                    // Add this card to the current turn cards
                    room.turnCards.push(playedCard);
                    // Send update of new players cards
                    io.to(data.roomId).emit('played-cards', room);

                    // Next player ?
                    if (room.turnCards.length < room.users.length) {
                        // Send update to every players of the current played cards
                        let playerIndex = utils.findIndexById(room.users, data.userId);

                        // Next player
                        playerIndex = (++playerIndex) % room.users.length;
                        room.playerTurn = room.users[playerIndex].id;

                        // Send update for the current turn
                        io.to(data.roomId).emit('player-turn', room.playerTurn);
                    } else {
                        // handle special cards
                        const specialCard = room.turnCards.find(c => c.special);
                        const highestCard =
                            // Search if the special card can won the fold
                            utils.getSpecialCardOnFoldWin({
                                specialCard: specialCard,
                                specialCardIndex: room.turnCards.indexOf(specialCard),
                                isLastCardInHand: player.cards.length === 0,
                                turnCards: room.turnCards,
                                turnType: room.turnType
                            }) ||
                            // Search highest card which won the fold
                            room.turnCards.reduce((c1, c2) => {
                                if (c1.type === c2.type && c1.type === room.turnType) {
                                    // same types, highest value
                                    return c1.value > c2.value ? c1 : c2;
                                } else {
                                    if (c1.type === room.turnType) {
                                        return c1;
                                    } else {
                                        return c2;
                                    }
                                }
                            });

                        // Update player folds and room cards
                        const winnerPlayer = room.users.find(p => p.id === highestCard.player);
                        room.lastFoldWinner = winnerPlayer.id;
                        const wonFold = {
                            order: room.turn,
                            cards: [...room.turnCards],
                            score: room.nextFoldScore !== 0 ? room.nextFoldScore : 0
                        };
                        winnerPlayer.folds.push(wonFold);
                        // Reset next fold score
                        if (room.nextFoldScore !== 0) {
                            winnerPlayer.score += room.nextFoldScore;
                            room.nextFoldScore = 0;
                        }

                        // If player won the 5 of dwarf, this will be the next game starter
                        for (const card of room.turnCards) {
                            utils.handleSpecialCardsEffects(card, {
                                winnerPlayer: winnerPlayer,
                                io: io,
                                room: room
                            });
                        }

                        // Save special card winner
                        if (specialCard) {
                            room.specialCard.winner = winnerPlayer.id;
                        }

                        // Start next turn, reset cards of the turn
                        room.turnCards.splice(0, room.turnCards.length);
                        room.turnType = '';

                        // When player has no card left, it's the end of the game
                        if (player.cards.length <= 0) {
                            room.playerTurn = '';
                            // COMPUTE SCORE
                            utils.computeScore(room);
                        } else {
                            // Otherwise, next first player is the fold winner
                            room.playerTurn = winnerPlayer.id;

                            // If the special card is the wizard, notify the player the card can be played now
                            if (room.specialCard.name === 'wizard') {
                                room.specialCard.canBePlayed = true;
                                io.to(data.roomId).emit('card-can-be-played', room.specialCard);
                            }
                        }

                        // Next game
                        io.to(data.roomId).emit('player-won-fold', {
                            winnerId: winnerPlayer.id,
                            previousFoldCards: wonFold.cards,
                            foldCards: wonFold.cards
                        });
                        room.turn++;
                    }
                }
            }
        }
    });

    // Handle when a player swaps their cards with another one
    socket.on('swap-hand-with', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            const swapperPlayer = room.users.find(p => p.id === data.userId);
            if (data.handsSwappedPlayer) {
                // All cards are swapped with the swapped player's hand
                const playerSwapped = room.users.find(p => p.id === data.handsSwappedPlayer);
                const swapperCards = [...swapperPlayer.cards];
                swapperPlayer.cards = [...playerSwapped.cards];
                playerSwapped.cards = [...swapperCards];
                // Change cards players property
                utils.changeCardPlayer(playerSwapped.cards, data.handsSwappedPlayer);
                utils.changeCardPlayer(swapperPlayer.cards, data.userId);
                // Notify players
                io.to(data.roomId).emit('player-swapped-cards', data.handsSwappedPlayer);
            } else if (data.cardsSwappedPlayer) {
                // The swapper player has to choose the cards to swap in the swapped player's hand
                room.cardsSwappedPlayer = data.cardsSwappedPlayer;
                socket.emit('select-cards-to-swap', {
                    player: swapperPlayer.id,
                    other: data.cardsSwappedPlayer,
                    playerCards: room.users.find(p => p.id === swapperPlayer.id).cards,
                    otherCards: utils.shuffle([...room.users.find(p => p.id === data.cardsSwappedPlayer).cards])
                });
            }
        }
    });

    // Handle when a player make everyone swaps their hands with another player according a direction
    socket.on('players-swap-dir', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            const dirOffset = data.swapDir === 'left' ? 1 : -1;
            const loopStart = data.swapDir === 'left' ? 0 : room.users.length - 1;
            const loopEnd = data.swapDir === 'left' ? room.users.length : -1;

            const firstPlayerCards = [...room.users[loopStart].cards];

            for (let i = loopStart, j = 0, player = null; i !== loopEnd; i += dirOffset) {
                j = i + dirOffset;
                player = room.users[i];
                if (j < 0) {
                    j = room.users.length - 1;
                } else if (j > room.users.length - 1) {
                    j = 0;
                }
                player.cards = [...room.users[j].cards];
            }
            room.users[loopEnd - dirOffset].cards = firstPlayerCards;
            // Change cards players property
            for (const user of room.users) {
                utils.changeCardPlayer(user.cards, user.id);
            }
            io.to(room.id).emit('players-cards-swapped', data.swapDir);
        }
    });

    // Handle when a player exchanges cards from their hand with another player
    socket.on('player-chose-cards-to-swap', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            const player = room.users.find(p => p.id === room.playerSwapCards);
            const other = room.users.find(p => p.id === room.cardsSwappedPlayer);
            const [playerCards, otherCards] =
            utils.swapCards(player.cards, other.cards, data.playerSelectedCards, data.otherSelectedCards);
            // Change cards players property
            utils.changeCardPlayer(player.cards, player.id);
            utils.changeCardPlayer(other.cards, other.id);
            // Notify players
            io.to(room.id).emit('players-swapped-cards', {
                playerId: room.playerSwapCards,
                otherId: room.cardsSwappedPlayer,
                playerCards: playerCards,
                otherCards: otherCards
            });
        }
    });

    // Handle when a player choose a card from the previous fold
    socket.on('player-choose-previous-fold-card', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            const player = room.users.find(p => p.id === data.userId);
            const other = room.users.find(p => p.id === room.lastFoldWinner);
            const otherFoldCards = other.folds[other.folds.length - 1].cards;

            // Swap the wizard with the selected card from the previous fold
            const [playerCards, otherCards] =
            utils.swapCards(
                player.cards, otherFoldCards, ['' + room.specialCard.id], [data.previousFoldCard],
                'folds'
            );
            // Save swapped card details
            const swappedCard = player.cards.find(c => c.id === +data.previousFoldCard);
            swappedCard.player = player.id;
            // Set wizard score in the fold of the other player
            const wizardCard = otherFoldCards.filter(c => c.id === room.specialCard.id)[0];
            wizardCard.player = player.id;
            wizardCard.winner = other.id;
            wizardCard.score = 0;
            wizardCard.turn = room.turn - 1;
            wizardCard.swap = {
                type: swappedCard.type,
                value: swappedCard.value,
                name: swappedCard.name
            };
            // Notify players
            io.to(room.id).emit('players-swapped-cards', {
                playerId: player.id,
                otherId: other.id,
                playerCards: playerCards,
                otherCards: otherCards,
                updatePreviousFold: {
                    other: other.id,
                    swapedCard: swappedCard.id,
                    wizardCard: wizardCard
                }
            });
        }
    });

    // Handle player quit event
    socket.on('disconnect', () => {
        const data = sockets[socket.id];
        if (data) {
            console.log('player-quit', data);
            delete sockets[socket.id];
            const room = rooms[data.roomId];
            if (room) {
                // Search player index
                let index = utils.findIndexById(room.users, data.userId);
                if (index >= 0) {
                    console.log('[player-quit]', data.userId, 'left the room', data.roomId);
                    // Remove player from room
                    room.users.splice(index, 1);
                    if (room.users.length === 0) {
                        // Delete empty room
                        delete rooms[data.roomId];
                        roomsCount--;
                    } else {
                        // Update players list
                        io.to(data.roomId).emit('players-list-changed', room);
                        if (room.status === 'full-lobby' && room.users.length < MAX_PLAYERS) room.status = 'lobby';
                    }
                } else {
                    console.log('[player-quit] user not found in room', data);
                }
            }
        }
    });
});

const port = process.env.PORT || 8080;
http.listen(port, () => {
    console.log('Server listening on *:' + port);
});