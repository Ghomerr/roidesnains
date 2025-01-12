exports.randomRoomId = () => {
    return 'XXXX-XXXX-XXXX-XXXX'.replace(/[X]/g, () => {
        return (Math.random() * 16 | 0).toString(16).toUpperCase();
    });
};

const getUsersList = (users) => {
    const list = [];
    users.forEach(u => list.push(u.id));
    return list;
};
exports.getUsersList = getUsersList;

exports.shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const findIndex = (array, attributeName, attributeValue) => {
    let searchedIndex = -1;
    for (let i = 0; i < array.length; i++) {
        if (array[i][attributeName] === attributeValue) {
            searchedIndex = i;
            break;
        }
    }
    return searchedIndex;
};
exports.findIndex = findIndex;

exports.findIndexById = (array, id) => {
    return findIndex(array, 'id', id);
};

const sortPlayerCards = (playerCards) => {
    playerCards.sort((c1, c2) => {
        const typeTest = c1.type.localeCompare(c2.type);
        if (typeTest === 0) {
            return c1.value - c2.value;
        } else {
            return typeTest;
        }
    });
};
exports.sortPlayerCards = sortPlayerCards;

exports.handleSpecialCardsEffects = (card, data) => {
    let player = null;
    if (card.effect === 'copy') {
        // Reset copied card data
        card.type = 'special';
        card.value = '0';
    } else if (card.type === 'dwarf') {
        if (card.value === 5) {
            data.winnerPlayer.isNextGameStarter = true;
        } else if (card.value === 1) {
            data.io.to(data.room.id).emit('player-swap-hand', card.player);
        } else if (card.value === 11) {
            if (card.index === 1) {
                card.score += 3;
                data.winnerPlayer.score += 3;
            } else {
                data.room.nextFoldScore = 3;
            }
        }
    } else if (card.type === 'knight') {
        if (card.value === 1 && card.turn === data.room.turn) {
            player = data.room.users.find(p => p.id === card.player);
            player.score += 3;
            if (player.id === data.winnerPlayer.id) {
                card.score += 3;
            } else {
                card.otherScore = 3;
            }
        } else if (card.value === 11) {
            if (card.index === 1) {
                data.winnerPlayer.scoreFactor = 2;
            } else {
                data.io.to(data.room.id).emit('swap-players-direction', card.player);
            }
        }
    } else if (card.type === 'goblin') {
        if (card.value === 1) {
            player = data.room.users.find(p => p.id === card.player);
            const score = data.room.turnCards.reduce((a, b) => a + (b.head ? 1 : 0), 0);
            player.score += score;
        } else if (card.value === 11) {
            if (card.index === 1) {
                card.score += -3;
                data.winnerPlayer.score -= 3;
            }
        }
    }
};

exports.getSpecialCardOnFoldWin = (data) => {
    let returnCard = null;
    if (data.specialCard) {
        if (data.specialCard.name === 'atout' && (data.specialCardIndex > 0 || !data.isLastCardInHand)) {
            returnCard = data.specialCard;
        } else if (data.specialCard.name === 'dragon') {
            // Search ace cards (champions) in the turn cards
            const championsCards = data.turnCards.filter(c => c.name === 'ace');
            if (championsCards.length) {
                // If there is a champion of the current turn type, let it win the turn
                const championOfTurnType = championsCards.find(c => c.type === data.turnType);
                // Otherwise, get the first champion who beat the dragon
                returnCard = championOfTurnType ? championOfTurnType : championsCards[0];
            }
            if (!returnCard) {
                // If no champion has been played, the dragon wins the turn
                returnCard = data.specialCard;
            }
        }
    }
    return returnCard;
};

exports.copyPreviousCardType = (data) => {
    let lastCard = null;
    if (data.turnCards.length) {
        // Last card of the current turn if it exists is used for the copy
        lastCard = data.turnCards[data.turnCards.length - 1];
    } else if (data.lastWinner) {
        // Use the last fold to find the card to copy
        const lastFold = data.lastWinner.folds.length ? data.lastWinner.folds[data.lastWinner.folds.length - 1] : null;
        if (lastFold) {
            if (data.getHighestCard) {
                // Highest card from the previous fold is used
                lastCard = lastFold.cards.find(c => c.player === data.lastWinner.id);
            } else {
                // Last card from the previous fold is used
                lastCard = lastFold.cards[lastFold.cards.length - 1];
            }
        }
    }

    // If a last card is found, copy the type and add a value to it
    if (lastCard) {
        data.card.type = lastCard.type;
        data.card.value = lastCard.value + data.card.copyValue;
        // Save special card copy details
        data.card.copy = {
            type: data.card.type,
            value: data.card.value,
            name: lastCard.name
        }
        return true;
    }

    return false;
};

exports.getLastFoldCards = (room) => {
    let lastFoldCards = [];
    const lastFoldPlayer = room.users.find(p => p.id === room.lastFoldWinner);
    if (lastFoldPlayer) {
        lastFoldCards = [...lastFoldPlayer.folds[lastFoldPlayer.folds.length - 1].cards];
    }
    return lastFoldCards;
};

exports.swapCards = (player1Cards, player2Cards, player1CardsIds, player2CardsIds, player2CardsSourceName = 'cards') => {
    const player1SelectedCards = player1Cards.filter(c => player1CardsIds.includes('' + c.id));
    for (const card of player1SelectedCards) {
        player1Cards.splice(findIndex(player1Cards, 'id', card.id), 1);
        player2Cards.push(card);
    }
    // Transfer swapped cards from the other player to the player
    const player2SelectedCards = player2Cards.filter(c => player2CardsIds.includes('' + c.id));
    for (const card of player2SelectedCards) {
        player1Cards.push(card);
        player2Cards.splice(findIndex(player2Cards, 'id', card.id), 1);
    }
    // Sort cards with the new ones
    sortPlayerCards(player1Cards);
    if (player2CardsSourceName === 'cards') {
        sortPlayerCards(player2Cards);
    }
    return [player1SelectedCards, player2SelectedCards];
};

exports.changeCardPlayer = (cards, player) => {
    for (const card of cards) {
        card.player = player;
    }
};

const ATTRIBUTE = 1,
    VALUE = 2,
    SCORE = 3;

exports.computeScore = (room) => {
    let groups = null;
    switch (room.currentQuest.code) {
        case '1-1':
        case '1-2':
        case '2-1':
        case '2-2':
        case '4-1':
        case '4-2':
        case '8-1':
        case '8-2':
        case '10-1':
        case '10-2':
        case '14-1':
        case '14-2':
        case '17-1':
        case '17-2':
        case '18-1':
        case '18-2':
            // Test card attribute against a value and give the following score
            const scoresList = room.currentQuest.score.split(',');
            for (const score of scoresList) {
                groups = score.match(/card\.([a-z]+)(?:==([a-z0-9]+))?:([+-]\d+)/);
                for (const player of room.users) {
                    for (const fold of player.folds) {
                        for (const card of fold.cards) {
                            if (!groups[VALUE] && card[groups[ATTRIBUTE]] || card[groups[ATTRIBUTE]] === groups[VALUE]) {
                                const score = +groups[SCORE] * player.scoreFactor;
                                card.score += score;
                                player.score += score;
                            }
                        }
                    }
                }
            }
            break;

        case '3-1':
        case '3-2':
            // Test folds attribute against a value and give the following score
            groups = room.currentQuest.score.match(/folds\.([a-z]+)==(\d+):([+-]\d+)/);
            for (const player of room.users) {
                const value = +groups[VALUE];
                const score = +groups[SCORE] * player.scoreFactor;
                if (player.folds[groups[ATTRIBUTE]] == value) {
                    player.score += score;
                    for (const fold of player.folds) {
                        fold.score += score / value;
                    }
                }
            }
            break;

        case '5-1':
        case '5-2':
            // Folds length add/remove the score
            groups = room.currentQuest.score.match(/(-?)folds\.length/);
            for (const player of room.users) {
                const scoreFactor = (groups[1] === '-' ? -1 : 1) * player.scoreFactor;
                player.score += scoreFactor * player.folds.length;
                for (const fold of player.folds) {
                    fold.score += scoreFactor;
                }
            }
            break;

        case '6-1':
            // Each triple cards gives one point
            for (const player of room.users) {
                let sortedCards = [];
                for (const fold of player.folds) {
                    sortedCards = sortedCards.concat(fold.cards);
                }
                if (sortedCards.length) {
                    sortedCards.sort((c1, c2) => {
                        return c1.name.localeCompare(c2.name);
                    });
                    let previousCards = [];
                    for (const card of sortedCards) {
                        const lastPreviousCard = previousCards.length ?
                            previousCards[previousCards.length - 1] : null;
                        if (!lastPreviousCard || lastPreviousCard.name !== card.name) {
                            if (previousCards.length === 3) {
                                const scoreFactor = (lastPreviousCard.head ? 2 : 1) * player.scoreFactor;
                                for (const c of previousCards) {
                                    c.score += 0.33 * scoreFactor;
                                }
                                player.score += scoreFactor;
                            }
                            previousCards = [card];
                        } else {
                            previousCards.push(card);
                        }
                    }
                }
            }
            break;

        case '6-2':
            // Longest straight gives one point per card, of at least 3 cards
            for (const player of room.users) {
                let sortedCards = [];
                for (const fold of player.folds) {
                    sortedCards = sortedCards.concat(fold.cards);
                }
                if (sortedCards.length) {
                    sortedCards.sort((c1, c2) => {
                        return c1.value - c2.value;
                    });

                    const straights = [];
                    let previousCards = [];
                    for (const card of sortedCards) {
                        if (card.type !== 'special') {
                            const lastPreviousCard = previousCards.length ?
                                previousCards[previousCards.length - 1] : null;
                            // First card or next card in the current straight or 10 then jack special case
                            if (!lastPreviousCard || (lastPreviousCard.value + 1) === card.value || lastPreviousCard.value === 10 && card.value === 12) {
                                previousCards.push(card);
                            } else if (lastPreviousCard.value !== card.value) {
                                // Only keep straights of at least 3 cards
                                if (previousCards.length >= 3) {
                                    straights.push([...previousCards]);
                                }
                                // New straight
                                previousCards = [card];
                            }
                        }
                    }
                    // last straight
                    if (previousCards.length >= 3) {
                        straights.push([...previousCards]);
                    }
                    if (straights.length) {
                        // get longest straight
                        const longestStraight = straights.reduce((s1, s2) => {
                            return s1.length > s2.length ? s1 : s2;
                        });
                        // Compute score
                        for (const card of longestStraight) {
                            card.score += player.scoreFactor;
                            player.score += player.scoreFactor;
                        }
                    }
                }
            }
            break;

        case '7-1':
        case '7-2':
            for (const player of room.users) {
                let sortedCards = {
                    'knight': [],
                    'goblin': [],
                    'dwarf': []
                };
                for (const fold of player.folds) {
                    for (const card of fold.cards) {
                        if (sortedCards.hasOwnProperty(card.type)) {
                            sortedCards[card.type].push(card);
                        }
                    }
                }
                const getLeastType = room.currentQuest.score.includes('least_color');
                let selectedType = 'knight';
                // Find the selected type to count according the given quest
                for (const [type, cards] of Object.entries(sortedCards)) {
                    // for the least type : cards type is chosen if there are less card than the previous and the cards are empty
                    // or the previous cars were empty
                    // for the most type : cards type is chosen if there are more card than the previous
                    if (getLeastType && cards.length > 0 &&
                        (cards.length < sortedCards[selectedType].length || sortedCards[selectedType].length === 0) ||
                        !getLeastType && cards.length > sortedCards[selectedType].length) {
                        selectedType = type;
                    }
                }
                // If no type is selected, select one type
                player.score += sortedCards[selectedType].length * player.scoreFactor;
                for (const card of sortedCards[selectedType]) {
                    card.score += player.scoreFactor;
                }
            }
            break;

        case '9-1':
        case '9-2':
            groups = room.currentQuest.score.match(/fold.([a-z]+)>=([^:]+):([+-]\d+)/);
            const lastFourTurns = room.turn - 4;
            for (const player of room.users) {
                const score = +groups[SCORE] * player.scoreFactor;
                for (const fold of player.folds) {
                    if (fold[groups[ATTRIBUTE]] >= lastFourTurns) {
                        fold.score += score;
                        player.score += score;
                    }
                }
            }
            break;

        case '11-1':
        case '11-2':
            const scoreFactor = room.currentQuest.score.match(/^[-]/) ? -1 : 1;
            for (const player of room.users) {
                let sortedCards = [];
                for (const fold of player.folds) {
                    sortedCards = sortedCards.concat(fold.cards);
                }
                if (sortedCards.length) {
                    sortedCards.sort((c1, c2) => {
                        return c1.value - c2.value;
                    });
                    const firstCard = sortedCards[0];
                    const score = (firstCard.head ? (scoreFactor > 0 ? 10 : 0) : firstCard.value * scoreFactor) * player.scoreFactor;
                    firstCard.score += score;
                    player.score += score;
                }
            }
            break;

        case '12-1':
        case '12-2':
            const playerOffset = room.currentQuest.score.match(/right/) ? 1 : -1;
            for (let i = 0; i < room.users.length; i++) {
                const player = room.users[i];
                let otherPlayerIndex = i + playerOffset;
                if (otherPlayerIndex < 0) {
                    otherPlayerIndex = room.users.length - 1;
                } else if (otherPlayerIndex >= room.users.length) {
                    otherPlayerIndex = 0;
                }
                const otherPlayer = room.users[otherPlayerIndex];
                player.score += otherPlayer.folds.length * player.scoreFactor;
            }
            break;

        case '13-1':
        case '13-2':
            groups = room.currentQuest.score.match(/card\.([a-z]+)==([a-z]+)/);
            for (const player of room.users) {
                let sortedCards = [];
                for (const fold of player.folds) {
                    sortedCards = sortedCards.concat(fold.cards);
                }
                if (sortedCards.length) {
                    sortedCards = sortedCards.filter(c => c[groups[ATTRIBUTE]] === groups[VALUE] && !c.head);
                    if (sortedCards.length) {
                        sortedCards.sort((c1, c2) => {
                            return c1.value - c2.value;
                        });
                        const firstCard = sortedCards[0];
                        const score = firstCard.value * player.scoreFactor;
                        firstCard.score += score;
                        player.score += score;
                    }
                }
            }
            break;

        case '15-1':
        case '15-2':
        case '16-1':
        case '16-2':
            groups = room.currentQuest.score.match(/folds\.length(?:([%])(\d+))?==([^:]+):([+-]\d+)/);
            for (const player of room.users) {
                let foldsValue = player.folds.length;
                if (foldsValue > 0) {
                    if (groups[1] && groups[2]) {
                        switch (groups[1]) {
                            case '%':
                                foldsValue %= +groups[2];
                                break;
                        }
                    }
                    if (foldsValue === +groups[3]) {
                        const score = +groups[4] * player.scoreFactor;
                        const foldScore = score / player.folds.length;
                        player.score += score;
                        for (const fold of player.folds) {
                            fold.score += +foldScore.toFixed(2);
                        }
                    }
                }
            }
            break;

        case '19-1':
        case '19-2':
            groups = room.currentQuest.score.match(/folds\.length([!=]=)folds\.others\.length:([+-]\d+)/);
            const isDifferent = groups[1] === '!=';
            for (const player of room.users) {
                let testFoldsValue = isDifferent;
                for (const other of room.users) {
                    if (other.id !== player.id && player.folds.length === other.folds.length) {
                        testFoldsValue = !isDifferent;
                        break;
                    }
                }
                if (testFoldsValue) {
                    const score = +groups[2] * player.scoreFactor;
                    const foldScore = score / player.folds.length;
                    player.score += score;
                    for (const fold of player.folds) {
                        fold.score += +foldScore.toFixed(2);
                    }
                }
            }
            break;

        case '20-1':
        case '20-2':
            groups = room.currentQuest.score.match(/card\.([a-z]+)==([a-z]+)&card\.([a-z]+)==([a-z]+):([+-]\d+)/);
            for (const player of room.users) {
                let sortedCards = [];
                for (const fold of player.folds) {
                    sortedCards = sortedCards.concat(fold.cards);
                }
                if (sortedCards.length) {
                    sortedCards.sort((c1, c2) => {
                        // Inverse order
                        return c2.value - c1.value;
                    });
                    const searchedCard = sortedCards.find((card) => {
                        return card[groups[1]] === groups[2] && card[groups[3]] === groups[4];
                    });
                    if (searchedCard) {
                        const score = +groups[5] * player.scoreFactor;
                        searchedCard.score += score;
                        player.score += score;
                    }
                }
            }
            break;
    };
}