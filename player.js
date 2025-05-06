class PlayerProfile {
    constructor() {
        this.player = null;
        this.allPlayers = [];
        this.init();
    }

    async init() {
        await this.loadPlayers();
        this.loadPlayer();
        this.setupEventListeners();
        this.setupPWAFeatures();
    }

    async loadPlayers() {
        try {
            if (navigator.onLine) {
                const response = await fetch('/data/players.json');
                this.allPlayers = (await response.json()).players;
                localStorage.setItem('players', JSON.stringify(this.allPlayers));
            } else {
                const savedPlayers = localStorage.getItem('players');
                if (savedPlayers) {
                    this.allPlayers = JSON.parse(savedPlayers);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            const savedPlayers = localStorage.getItem('players');
            if (savedPlayers) {
                this.allPlayers = JSON.parse(savedPlayers);
            }
        }
    }

    setupPWAFeatures() {
        // Оффлайн-статус
        const updateOnlineStatus = () => {
            const statusElement =
                document.getElementById('online-status') || document.createElement('div');
            statusElement.id = 'online-status';
            statusElement.className = `online-status ${
                navigator.onLine ? 'online' : 'offline'
            }`;
            statusElement.textContent = navigator.onLine ? 'Онлайн' : 'Оффлайн';
            document.body.prepend(statusElement);
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
    }

    loadPlayer() {
        const urlParams = new URLSearchParams(window.location.search);
        const playerId = parseInt(urlParams.get('id'));

        if (!playerId) throw new Error('ID игрока не указан');

        const player = this.allPlayers.find((p) => p.id === playerId);
        if (!player) throw new Error('Игрок не найден');

        this.player = {
            id: player.id,
            name: player.name || 'Неизвестный игрок',
            skill: this.validateSkill(player.skill),
            interactions: player.interactions || {},
            matchWins: player.matchWins || 0,
            cupWins: player.cupWins || 0,
            isCaptain: player.isCaptain || false,
        };

        this.renderProfile();
    }

    validateSkill(skill) {
        const num = parseFloat(skill);
        return isNaN(num) ? 0.5 : Math.min(1, Math.max(0.1, parseFloat(num.toFixed(2))));
    }

    setupEventListeners() {
        document
            .getElementById('edit-player-btn')
            .addEventListener('click', () => this.showEditModal());
        document
            .getElementById('delete-player-btn')
            .addEventListener('click', () => this.deletePlayer());
        document
            .getElementById('save-player-btn')
            .addEventListener('click', () => this.savePlayer());
        document
            .getElementById('cancel-edit-btn')
            .addEventListener('click', () => this.hideEditModal());
    }

    showEditModal() {
        document.getElementById('edit-name').value = this.player.name;
        document.getElementById('edit-skill').value = this.player.skill;
        document.getElementById('edit-player-modal').classList.add('active');
    }

    hideEditModal() {
        document.getElementById('edit-player-modal').classList.remove('active');
    }

    async savePlayer() {
        try {
            const newName = document.getElementById('edit-name').value.trim();
            const newSkill = parseFloat(document.getElementById('edit-skill').value);

            if (!newName) throw new Error('Пожалуйста, введите имя игрока');
            if (isNaN(newSkill) || newSkill < 0.1 || newSkill > 1) {
                throw new Error('Навык должен быть числом от 0.1 до 1.0');
            }

            this.player.name = newName;
            this.player.skill = this.validateSkill(newSkill);

            const playerIndex = this.allPlayers.findIndex((p) => p.id === this.player.id);
            if (playerIndex !== -1) {
                this.allPlayers[playerIndex] = { ...this.player };
                await localStorage.setItem('players', JSON.stringify(this.allPlayers));
                this.hideEditModal();
                this.renderProfile();
            } else {
                throw new Error('Игрок не найден в базе');
            }
        } catch (error) {
            alert(error.message);
        }
    }

    async deletePlayer() {
        if (confirm(`Вы уверены, что хотите удалить игрока ${this.player.name}?`)) {
            try {
                this.allPlayers = this.allPlayers.filter((p) => p.id !== this.player.id);

                this.allPlayers.forEach((player) => {
                    if (player.interactions && player.interactions[this.player.id]) {
                        delete player.interactions[this.player.id];
                    }
                });

                await localStorage.setItem('players', JSON.stringify(this.allPlayers));
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Ошибка при удалении:', error);
                alert('Произошла ошибка при удалении игрока');
            }
        }
    }

    renderProfile() {
        document.getElementById('player-name').textContent = this.player.name;

        document.getElementById('player-info').innerHTML = `
            <div class="player-header">
                <h2>${this.player.name}</h2>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Навык</h4>
                    <p class="stat-value">${this.player.skill.toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h4>Победы (матчи)</h4>
                    <p class="stat-value">${this.player.matchWins}</p>
                </div>
                <div class="stat-card">
                    <h4>Победы (кубки)</h4>
                    <p class="stat-value">${this.player.cupWins}</p>
                </div>
            </div>
        `;

        this.renderBestPartners();
    }

    renderBestPartners() {
        const container = document.getElementById('best-partners');

        if (
            !this.player.interactions ||
            Object.keys(this.player.interactions).length === 0
        ) {
            container.innerHTML =
                '<p>Нет данных о взаимодействиях с другими игроками</p>';
            return;
        }

        const partners = this.allPlayers
            .filter((p) => p.id !== this.player.id && this.player.interactions[p.id])
            .map((p) => ({
                player: p,
                interaction: this.player.interactions[p.id] || 0.5,
            }))
            .sort((a, b) => b.interaction - a.interaction)
            .slice(0, 5);

        if (partners.length === 0) {
            container.innerHTML = '<p>Нет данных о партнерах</p>';
            return;
        }

        container.innerHTML = partners
            .map(
                (partner) => `
            <div class="partner-card">
                <div class="partner-header">
                    <h4><a href="player.html?id=${partner.player.id}">${
                    partner.player.name
                }</a></h4>
                    <span class="interaction-badge">${partner.interaction.toFixed(
                        2
                    )}</span>
                </div>
                <div class="partner-stats">
                    <p><strong>Навык:</strong> ${partner.player.skill.toFixed(2)}</p>
                    <p><strong>Матчи:</strong> ${partner.player.matchWins || 0}</p>
                    <p><strong>Кубки:</strong> ${partner.player.cupWins || 0}</p>
                </div>
            </div>
        `
            )
            .join('');
    }

    showError(message) {
        document.getElementById('player-name').textContent = 'Ошибка';
        document.getElementById('player-info').innerHTML = `
            <div class="error-message">${message}</div>
        `;
        document.querySelector('.partners-section').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PlayerProfile();
});
