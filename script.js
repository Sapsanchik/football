class FootballManager {
    constructor() {
        this.players = [];
        this.teams = [];
        this.selectedPlayers = new Set();
        this.currentSort = 'name';
        this.draggedPlayer = null;
        this.selectedForAutoTeam = new Set();
        this.init();
    }

    async init() {
        await this.checkNetworkStatus();
        await this.loadPlayers();
        this.setupEventListeners();
        this.renderAllPlayers();
    }

    async checkNetworkStatus() {
        if (!navigator.onLine) {
            this.showOfflineMessage();
        }
        window.addEventListener('online', () => {
            this.hideOfflineMessage();
            this.syncData();
        });
        window.addEventListener('offline', () => this.showOfflineMessage());
    }

    showOfflineMessage() {
        let message = document.getElementById('offline-message');
        if (!message) {
            message = document.createElement('div');
            message.id = 'offline-message';
            message.className = 'offline-message';
            message.textContent = 'Вы в оффлайн-режиме. Данные могут быть неактуальны.';
            document.body.prepend(message);
        }
    }

    hideOfflineMessage() {
        const message = document.getElementById('offline-message');
        if (message) message.remove();
    }

    async syncData() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            try {
                await registration.sync.register('sync-data');
                console.log('Фоновая синхронизация зарегистрирована');
            } catch (err) {
                console.error('Ошибка синхронизации:', err);
            }
        }
    }

    async loadPlayers() {
        try {
            if (navigator.onLine) {
                const response = await fetch('/data/players.json');
                const data = await response.json();
                this.players = data.players;
                localStorage.setItem('players', JSON.stringify(this.players));
            } else {
                const savedPlayers = localStorage.getItem('players');
                if (savedPlayers) {
                    this.players = JSON.parse(savedPlayers);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            const savedPlayers = localStorage.getItem('players');
            if (savedPlayers) {
                this.players = JSON.parse(savedPlayers);
            }
        }
    }

    async savePlayers() {
        localStorage.setItem('players', JSON.stringify(this.players));

        if (navigator.onLine) {
            try {
                console.log('Данные сохранены локально и отправлены на сервер');
            } catch (error) {
                console.error('Ошибка синхронизации:', error);
            }
        }
    }

    initPlayerFields(player) {
        return {
            id: player.id || this.generateId(),
            name: player.name || 'Неизвестный игрок',
            skill: this.validateSkill(player.skill),
            interactions: player.interactions || {},
            matchWins: player.matchWins || 0,
            cupWins: player.cupWins || 0,
            isCaptain: player.isCaptain || false,
        };
    }

    generateId() {
        return this.players.length > 0
            ? Math.max(...this.players.map((p) => p.id)) + 1
            : 1;
    }

    validateSkill(skill) {
        const num = parseFloat(skill);
        return isNaN(num) ? 0.5 : Math.min(1, Math.max(0.1, parseFloat(num.toFixed(2))));
    }

    initInteractions() {
        this.players.forEach((player1) => {
            this.players.forEach((player2) => {
                if (player1.id !== player2.id && !player1.interactions[player2.id]) {
                    player1.interactions[player2.id] = 0.5;
                }
            });
        });
    }

    setupEventListeners() {
        document.getElementById('manual-team-creation').addEventListener('click', () => {
            if (this.players.length < 2) {
                alert('Для формирования команд нужно минимум 2 игрока');
                return;
            }
            this.showTeamCountSelector('manual');
        });

        document.getElementById('auto-team-creation').addEventListener('click', () => {
            if (this.players.length < 4) {
                alert('Для автоматического формирования нужно минимум 4 игрока');
                return;
            }
            this.showTeamCountSelector('auto');
        });

        document.getElementById('confirm-team-count').addEventListener('click', () => {
            const teamCount = parseInt(document.getElementById('team-count').value);
            if (teamCount < 2 || teamCount > 10) {
                alert('Количество команд должно быть от 2 до 10');
                return;
            }

            if (this.creationMode === 'manual') {
                this.prepareManualTeamCreation(teamCount);
            }
        });

        document.getElementById('reset-teams').addEventListener('click', () => {
            this.teams = [];
            this.selectedPlayers.clear();
            this.renderTeams();
            this.renderAllPlayers();
            document.getElementById('manual-team-creation-area').classList.add('hidden');
            document.getElementById('auto-team-creation-area').classList.add('hidden');
        });

        document.getElementById('add-player-btn').addEventListener('click', () => {
            this.showAddPlayerForm();
        });

        document.getElementById('apply-sort').addEventListener('click', () => {
            this.currentSort = document.getElementById('sort-by').value;
            this.renderAllPlayers();
        });

        document.getElementById('select-all-players').addEventListener('click', () => {
            this.selectAllPlayers(true);
        });

        document.getElementById('deselect-all-players').addEventListener('click', () => {
            this.selectAllPlayers(false);
        });

        document
            .getElementById('confirm-player-selection')
            .addEventListener('click', () => {
                this.createTeamsWithSelectedPlayers();
            });

        // Drag and Drop
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('player-card')) {
                this.draggedPlayer = this.players.find(
                    (p) => p.id == e.target.dataset.playerId
                );
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.playerId);
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('player-card')) {
                e.target.classList.remove('dragging');
            }
        });

        document.addEventListener('dragover', (e) => {
            if (
                e.target.classList.contains('dropzone') ||
                e.target.classList.contains('manual-team')
            ) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                e.target.classList.add('active');
            }
        });

        document.addEventListener('dragleave', (e) => {
            if (
                e.target.classList.contains('dropzone') ||
                e.target.classList.contains('manual-team')
            ) {
                e.target.classList.remove('active');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (
                e.target.classList.contains('dropzone') ||
                e.target.classList.contains('manual-team')
            ) {
                e.target.classList.remove('active');

                const playerId = e.dataTransfer.getData('text/plain');
                const player = this.players.find((p) => p.id == playerId);
                const teamIndex = e.target.closest('.manual-team')?.dataset.teamIndex;

                if (teamIndex !== undefined && player) {
                    this.addPlayerToManualTeam(player, parseInt(teamIndex));
                }
            }
        });
    }

    showAddPlayerForm() {
        const playersContainer = document.getElementById('players-list');
        if (document.getElementById('add-player-form')) return;

        const form = document.createElement('div');
        form.id = 'add-player-form';
        form.innerHTML = `
            <h3>Добавить нового игрока</h3>
            <div class="form-group">
                <label for="new-player-lastname">Фамилия:</label>
                <input type="text" id="new-player-lastname" required>
            </div>
            <div class="form-group">
                <label for="new-player-firstname">Имя:</label>
                <input type="text" id="new-player-firstname" required>
            </div>
            <div class="form-group">
                <label for="new-player-middlename">Отчество:</label>
                <input type="text" id="new-player-middlename">
            </div>
            <div class="form-group">
                <label for="new-player-skill">Навык (0.1-1.0):</label>
                <input type="number" id="new-player-skill" min="0.1" max="1" step="0.01" value="0.5" required>
            </div>
            <div class="form-actions">
                <button id="save-new-player">Сохранить</button>
                <button id="cancel-add-player">Отмена</button>
            </div>
        `;

        playersContainer.prepend(form);

        document.getElementById('save-new-player').addEventListener('click', () => {
            this.addNewPlayer();
        });

        document.getElementById('cancel-add-player').addEventListener('click', () => {
            form.remove();
        });
    }

    addNewPlayer() {
        const lastName = document.getElementById('new-player-lastname').value.trim();
        const firstName = document.getElementById('new-player-firstname').value.trim();
        const middleName = document.getElementById('new-player-middlename').value.trim();
        const skill = parseFloat(document.getElementById('new-player-skill').value);

        if (!lastName || !firstName || isNaN(skill) || skill < 0.1 || skill > 1) {
            alert('Пожалуйста, заполните все обязательные поля корректно!');
            return;
        }

        const newPlayer = {
            id: this.generateId(),
            name: `${lastName} ${firstName} ${middleName}`.trim(),
            skill: this.validateSkill(skill),
            interactions: {},
            matchWins: 0,
            cupWins: 0,
            isCaptain: false,
        };

        this.players.forEach((player) => {
            newPlayer.interactions[player.id] = 0.5;
            player.interactions[newPlayer.id] = 0.5;
        });

        this.players.push(newPlayer);
        this.savePlayers();
        document.getElementById('add-player-form').remove();
        this.renderAllPlayers();
    }

    deletePlayer(playerId) {
        if (confirm('Вы уверены, что хотите удалить этого игрока?')) {
            this.teams.forEach((team) => {
                const index = team.findIndex((p) => p.id === playerId);
                if (index !== -1) team.splice(index, 1);
            });

            this.players = this.players.filter((p) => p.id !== playerId);
            this.players.forEach((player) => {
                delete player.interactions[playerId];
            });

            this.savePlayers();
            this.renderTeams();
            this.renderAllPlayers();
        }
    }

    showTeamCountSelector(mode) {
        this.creationMode = mode;
        if (mode === 'auto') {
            document.getElementById('auto-team-creation-area').classList.remove('hidden');
            this.renderPlayersSelection();
        }
        document.getElementById('team-count-selector').classList.remove('hidden');
    }

    selectAllPlayers(select) {
        if (select) {
            this.players.forEach((player) => this.selectedForAutoTeam.add(player.id));
        } else {
            this.selectedForAutoTeam.clear();
        }
        this.renderPlayersSelection();
    }

    renderPlayersSelection() {
        const container = document.getElementById('players-selection-list');
        container.innerHTML = this.players
            .map(
                (player) => `
            <div class="player-selection-card ${
                this.selectedForAutoTeam.has(player.id) ? 'selected' : ''
            }" data-player-id="${player.id}">
                <div class="checkbox-container">
                    <input type="checkbox" ${
                        this.selectedForAutoTeam.has(player.id) ? 'checked' : ''
                    }>
                    <div class="player-header">
                        <h4>${player.name}</h4>
                        <span class="player-skill">${player.skill.toFixed(2)}</span>
                    </div>
                </div>
                <div class="player-stats">
                    <p>Матчи: ${player.matchWins || 0}</p>
                    <p>Кубки: ${player.cupWins || 0}</p>
                </div>
            </div>
        `
            )
            .join('');

        container.querySelectorAll('input').forEach((checkbox, index) => {
            checkbox.addEventListener('change', (e) => {
                const playerId = this.players[index].id;
                if (e.target.checked) {
                    this.selectedForAutoTeam.add(playerId);
                } else {
                    this.selectedForAutoTeam.delete(playerId);
                }
                e.target
                    .closest('.player-selection-card')
                    .classList.toggle('selected', e.target.checked);
            });
        });
    }

    createTeamsWithSelectedPlayers() {
        const teamCount = parseInt(document.getElementById('team-count').value);
        if (teamCount < 2 || teamCount > 10) {
            alert('Количество команд должно быть от 2 до 10');
            return;
        }

        if (this.selectedForAutoTeam.size < teamCount * 2) {
            alert(`Для ${teamCount} команд нужно минимум ${teamCount * 2} игроков`);
            return;
        }

        const selectedPlayers = this.players.filter((p) =>
            this.selectedForAutoTeam.has(p.id)
        );
        this.createTeamsFromPlayers(teamCount, selectedPlayers);
    }

    createTeamsFromPlayers(teamCount, playersList) {
        this.teams = Array.from({ length: teamCount }, () => []);
        const sortedPlayers = [...playersList].sort((a, b) => b.skill - a.skill);

        let forward = true;
        let teamIndex = 0;
        const teamOrder = Array.from({ length: teamCount }, (_, i) => i);

        for (let i = 0; i < sortedPlayers.length; i++) {
            const playerCopy = { ...sortedPlayers[i] };
            if (i < teamCount) playerCopy.isCaptain = true;

            this.teams[teamOrder[teamIndex]].push(playerCopy);

            if (forward) {
                teamIndex++;
                if (teamIndex >= teamCount) {
                    teamIndex = teamCount - 1;
                    forward = false;
                }
            } else {
                teamIndex--;
                if (teamIndex < 0) {
                    teamIndex = 0;
                    forward = true;
                }
            }
        }

        this.renderTeams();
        document.getElementById('auto-team-creation-area').classList.add('hidden');
    }

    prepareManualTeamCreation(teamCount) {
        this.teams = Array.from({ length: teamCount }, () => []);
        document.getElementById('manual-team-creation-area').classList.remove('hidden');
        this.renderManualTeamCreation(teamCount);
    }

    renderManualTeamCreation(teamCount) {
        const teamsContainer = document.getElementById('teams-container');
        teamsContainer.innerHTML = Array.from(
            { length: teamCount },
            (_, i) => `
            <div class="manual-team dropzone" data-team-index="${i}">
                <h3>Команда ${i + 1}</h3>
                <div class="team-players" id="manual-team-${i}"></div>
                <div class="team-actions">
                    <div class="match-controls">
                        <h4>Основной матч:</h4>
                        <button class="result-btn win-btn" data-team-index="${i}" data-result-type="matchWin">Победа</button>
                        <button class="result-btn lose-btn" data-team-index="${i}" data-result-type="matchLose">Поражение</button>
                    </div>
                    <div class="cup-controls">
                        <h4>Кубок:</h4>
                        <button class="result-btn win-btn" data-team-index="${i}" data-result-type="cupWin">Победа</button>
                        <button class="result-btn lose-btn" data-team-index="${i}" data-result-type="cupLose">Поражение</button>
                    </div>
                </div>
            </div>
        `
        ).join('');

        teamsContainer.querySelectorAll('.result-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const teamIndex = parseInt(e.target.dataset.teamIndex);
                const resultType = e.target.dataset.resultType;

                let isMatchWin, isCupWin;
                switch (resultType) {
                    case 'matchWin':
                        isMatchWin = true;
                        break;
                    case 'matchLose':
                        isMatchWin = false;
                        break;
                    case 'cupWin':
                        isCupWin = true;
                        break;
                    case 'cupLose':
                        isCupWin = false;
                        break;
                }

                this.recordMatchResult(teamIndex, isMatchWin, isCupWin);
            });
        });

        this.renderAvailablePlayers();
    }

    renderAvailablePlayers() {
        const assignedPlayers = new Set();
        this.teams.forEach((team) =>
            team.forEach((player) => assignedPlayers.add(player.id))
        );

        const availablePlayers = this.players.filter(
            (player) => !assignedPlayers.has(player.id)
        );
        const container = document.getElementById('available-players-list');

        container.innerHTML = availablePlayers
            .map(
                (player) => `
            <div class="player-card" data-player-id="${player.id}" draggable="true">
                <div class="player-header">
                    <h4>${player.name}</h4>
                    <div class="player-actions">
                        <a href="player.html?id=${
                            player.id
                        }" class="profile-btn">Профиль</a>
                        <button class="delete-player-btn" data-player-id="${
                            player.id
                        }">×</button>
                    </div>
                </div>
                <div class="player-stats">
                    <p>Навык: <strong>${player.skill.toFixed(2)}</strong></p>
                    <p>Матчи: <strong>${player.matchWins || 0}</strong></p>
                    <p>Кубки: <strong>${player.cupWins || 0}</strong></p>
                </div>
            </div>
        `
            )
            .join('');

        container.querySelectorAll('.delete-player-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePlayer(parseInt(e.target.dataset.playerId));
            });
        });
    }

    addPlayerToManualTeam(player, teamIndex) {
        this.teams.forEach((team, index) => {
            if (index !== teamIndex) {
                const playerIndex = team.findIndex((p) => p.id === player.id);
                if (playerIndex !== -1) team.splice(playerIndex, 1);
            }
        });

        if (!this.teams[teamIndex].some((p) => p.id === player.id)) {
            const playerCopy = { ...player };
            if (this.teams[teamIndex].length === 0) playerCopy.isCaptain = true;
            this.teams[teamIndex].push(playerCopy);
        }

        this.renderManualTeamPlayers();
        this.renderAvailablePlayers();
    }

    renderManualTeamPlayers() {
        this.teams.forEach((team, index) => {
            const container = document.getElementById(`manual-team-${index}`);
            if (!container) return;

            container.innerHTML = team
                .map(
                    (player, i) => `
                <div class="player-item">
                    <div class="player-info">
                        ${player.name} ${
                        player.isCaptain
                            ? '<span class="captain-badge">Капитан</span>'
                            : ''
                    }
                    </div>
                    <div class="player-skill">${player.skill.toFixed(2)}</div>
                </div>
            `
                )
                .join('');
        });
    }

    renderTeams() {
        const container = document.getElementById('teams-display');
        container.innerHTML = this.teams
            .filter((team) => team.length > 0)
            .map(
                (team, index) => `
            <div class="team-card">
                <h3>Команда ${index + 1}</h3>
                <div class="team-players">
                    ${team
                        .map(
                            (player, i) => `
                        <div class="player-item">
                            <div class="player-info">
                                ${player.name} ${
                                player.isCaptain
                                    ? '<span class="captain-badge">Капитан</span>'
                                    : ''
                            }
                            </div>
                            <div class="player-skill">${player.skill.toFixed(2)}</div>
                        </div>
                    `
                        )
                        .join('')}
                </div>
                <div class="team-stats">
                    <p><strong>Средний навык:</strong> ${(
                        team.reduce((sum, p) => sum + p.skill, 0) / team.length
                    ).toFixed(2)}</p>
                    <p><strong>Среднее взаимодействие:</strong> ${this.calculateTeamInteraction(
                        team
                    ).toFixed(2)}</p>
                </div>
                <div class="team-actions">
                    <div class="match-controls">
                        <h4>Основной матч:</h4>
                        <button class="result-btn win-btn" data-team-index="${index}" data-result-type="matchWin">Победа</button>
                        <button class="result-btn lose-btn" data-team-index="${index}" data-result-type="matchLose">Поражение</button>
                    </div>
                    <div class="cup-controls">
                        <h4>Кубок:</h4>
                        <button class="result-btn win-btn" data-team-index="${index}" data-result-type="cupWin">Победа</button>
                        <button class="result-btn lose-btn" data-team-index="${index}" data-result-type="cupLose">Поражение</button>
                    </div>
                </div>
            </div>
        `
            )
            .join('');

        container.querySelectorAll('.result-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const teamIndex = parseInt(e.target.dataset.teamIndex);
                const resultType = e.target.dataset.resultType;

                let isMatchWin, isCupWin;
                switch (resultType) {
                    case 'matchWin':
                        isMatchWin = true;
                        break;
                    case 'matchLose':
                        isMatchWin = false;
                        break;
                    case 'cupWin':
                        isCupWin = true;
                        break;
                    case 'cupLose':
                        isCupWin = false;
                        break;
                }

                this.recordMatchResult(teamIndex, isMatchWin, isCupWin);
            });
        });
    }

    calculateTeamInteraction(team) {
        let total = 0;
        let count = 0;

        for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
                total +=
                    (team[i].interactions[team[j].id] || 0.5) +
                    (team[j].interactions[team[i].id] || 0.5);
                count += 2;
            }
        }

        return count ? total / count : 0;
    }

    recordMatchResult(teamIndex, isMatchWin, isCupWin) {
        const team = this.teams[teamIndex];
        if (!team) return;

        team.forEach((player) => {
            if (isMatchWin !== undefined) {
                player.skill = this.validateSkill(
                    player.skill + (isMatchWin ? 0.01 : -0.01)
                );

                // Изменяем взаимодействие как при победе, так и при поражении
                team.forEach((teammate) => {
                    if (player.id !== teammate.id) {
                        const currentInteraction =
                            player.interactions[teammate.id] || 0.5;
                        const interactionChange = isMatchWin ? 0.05 : -0.05;
                        player.interactions[teammate.id] = this.validateSkill(
                            currentInteraction + interactionChange
                        );
                    }
                });
            }

            if (isMatchWin !== undefined)
                player.matchWins = (player.matchWins || 0) + (isMatchWin ? 1 : 0);
            if (isCupWin !== undefined)
                player.cupWins = (player.cupWins || 0) + (isCupWin ? 1 : 0);

            this.syncPlayerData(player);
        });

        this.savePlayers();
        this.renderTeams();
        this.renderAllPlayers();

        const matchResult =
            isMatchWin !== undefined
                ? isMatchWin
                    ? 'Победа'
                    : 'Поражение'
                : 'Не играли';
        const cupResult =
            isCupWin !== undefined ? (isCupWin ? 'Победа' : 'Поражение') : 'Не играли';
        alert(
            `Результаты сохранены:\nОсновной матч: ${matchResult}\nКубок: ${cupResult}`
        );
    }

    syncPlayerData(updatedPlayer) {
        const index = this.players.findIndex((p) => p.id === updatedPlayer.id);
        if (index !== -1) {
            this.players[index] = { ...updatedPlayer };
        }
    }

    renderAllPlayers() {
        const sortedPlayers = [...this.players].sort((a, b) =>
            this.currentSort === 'name' ? a.name.localeCompare(b.name) : b.skill - a.skill
        );

        const container = document.getElementById('players-list');
        container.innerHTML = sortedPlayers
            .map(
                (player) => `
            <div class="player-card" data-player-id="${player.id}" draggable="true">
                <div class="player-header">
                    <h4>${player.name}</h4>
                    <div class="player-actions">
                        <a href="player.html?id=${
                            player.id
                        }" class="profile-btn">Профиль</a>
                        <button class="delete-player-btn" data-player-id="${
                            player.id
                        }">×</button>
                    </div>
                </div>
                <div class="player-stats">
                    <p>Навык: <strong>${player.skill.toFixed(2)}</strong></p>
                    <p>Матчи: <strong>${player.matchWins || 0}</strong></p>
                    <p>Кубки: <strong>${player.cupWins || 0}</strong></p>
                </div>
            </div>
        `
            )
            .join('');

        container.querySelectorAll('.delete-player-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePlayer(parseInt(e.target.dataset.playerId));
            });
        });

        document.getElementById(
            'total-players-count'
        ).textContent = `(${this.players.length})`;
    }

    savePlayers() {
        localStorage.setItem('players', JSON.stringify(this.players));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const manager = new FootballManager();

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            manager.savePlayers();
            alert('Данные сохранены');
        }
    });
});
