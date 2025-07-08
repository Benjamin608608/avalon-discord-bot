const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// 創建Discord客戶端
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ]
});

// 阿瓦隆角色列表（按照你指定的順序）
const AVALON_ROLES = [
    '梅林', '莫德雷德', '派希維爾', '莫甘娜', '平民1', 
    '平民2', '刺客', '平民3', '奧伯倫', '平民4'
];

// 遊戲狀態
let gameStates = new Map(); // 使用Map來支援多伺服器

// 機器人準備就緒時的事件
client.once('ready', () => {
    console.log(`機器人已上線！登錄為 ${client.user.tag}`);
});

// 訊息事件監聽器
client.on('messageCreate', async (message) => {
    // 忽略機器人自己的訊息
    if (message.author.bot) return;
    
    // 處理 !start 指令
    if (message.content === '!start') {
        await handleStartCommand(message);
    }
});

// 監聽表情符號反應被添加
client.on('messageReactionAdd', async (reaction, user) => {
    // 忽略機器人自己的反應
    if (user.bot) return;
    
    // 處理部分獲取的反應
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('獲取反應時發生錯誤:', error);
            return;
        }
    }
    
    const guildId = reaction.message.guild?.id;
    if (!guildId) return;
    
    const gameState = gameStates.get(guildId);
    if (!gameState || !gameState.isStarting) return;
    
    // 檢查是否是遊戲訊息且是正確的表情符號
    if (reaction.message.id === gameState.gameMessageId && reaction.emoji.name === '🎮') {
        
        // 檢查玩家是否已經加入
        if (gameState.players.has(user.id)) {
            return;
        }
        
        // 檢查人數限制
        if (gameState.players.size >= 10) {
            return;
        }
        
        // 加入玩家
        gameState.players.add(user.id);
        console.log(`${user.displayName} 通過表情符號加入了遊戲 (${gameState.players.size}/10)`);
        
        // 更新遊戲訊息
        await updateGameMessage(guildId);
    }
});

// 監聽表情符號反應被移除
client.on('messageReactionRemove', async (reaction, user) => {
    // 忽略機器人
    if (user.bot) return;
    
    // 處理部分獲取的反應
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('獲取反應時發生錯誤:', error);
            return;
        }
    }
    
    const guildId = reaction.message.guild?.id;
    if (!guildId) return;
    
    const gameState = gameStates.get(guildId);
    if (!gameState || !gameState.isStarting) return;
    
    // 檢查是否是遊戲訊息且是正確的表情符號
    if (reaction.message.id === gameState.gameMessageId && reaction.emoji.name === '🎮') {
        
        // 移除玩家
        if (gameState.players.has(user.id)) {
            gameState.players.delete(user.id);
            console.log(`${user.displayName} 退出了遊戲 (${gameState.players.size}/10)`);
            
            // 更新遊戲訊息
            await updateGameMessage(guildId);
        }
    }
});

// 處理開始遊戲指令
async function handleStartCommand(message) {
    const guildId = message.guild.id;
    
    // 檢查是否已經有遊戲在進行
    if (gameStates.has(guildId) && gameStates.get(guildId).isStarting) {
        message.reply('遊戲已經在進行中！請等待當前遊戲結束。');
        return;
    }
    
    // 初始化遊戲狀態
    gameStates.set(guildId, {
        isStarting: true,
        players: new Set(),
        gameMessageId: null,
        channel: message.channel
    });
    
    // 創建嵌入式訊息 - 使用單一穩定的表情符號
    const embed = new EmbedBuilder()
        .setTitle('🏰 阿瓦隆遊戲開始！')
        .setDescription('請參與玩家按下表情符號加入遊戲\n\n🎮 點擊下方的 🎮 表情符號加入遊戲\n⏰ 30秒後開始分配角色\n\n👥 **目前參與玩家：** 0人')
        .setColor('#FFD700')
        .setTimestamp();
    
    // 發送訊息
    const gameMessage = await message.channel.send({ embeds: [embed] });
    
    // 添加單一表情符號
    try {
        await gameMessage.react('🎮');
    } catch (error) {
        console.error('添加表情符號時發生錯誤:', error);
        message.channel.send('❌ 無法添加表情符號，請檢查機器人權限！');
        gameStates.delete(guildId);
        return;
    }
    
    gameStates.get(guildId).gameMessageId = gameMessage.id;
    
    // 30秒後開始遊戲
    setTimeout(async () => {
        await startGame(guildId);
    }, 30000);
}

// 更新遊戲訊息
async function updateGameMessage(guildId) {
    const gameState = gameStates.get(guildId);
    if (!gameState || !gameState.gameMessageId) return;
    
    try {
        const gameMessage = await gameState.channel.messages.fetch(gameState.gameMessageId);
        const playerList = [];
        
        for (const playerId of gameState.players) {
            const member = gameState.channel.guild.members.cache.get(playerId);
            if (member) {
                playerList.push(member.displayName);
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🏰 阿瓦隆遊戲開始！')
            .setDescription(`請參與玩家按下表情符號加入遊戲\n\n🎮 點擊下方的 🎮 表情符號加入遊戲\n⏰ 30秒後開始分配角色\n\n👥 **目前參與玩家：** ${gameState.players.size}人${gameState.players.size > 0 ? `\n${playerList.join(', ')}` : ''}`)
            .setColor('#FFD700')
            .setTimestamp();
        
        await gameMessage.edit({ embeds: [embed] });
    } catch (error) {
        console.error('更新遊戲訊息時發生錯誤:', error);
    }
}

// 開始遊戲並分配角色
async function startGame(guildId) {
    const gameState = gameStates.get(guildId);
    if (!gameState || !gameState.isStarting) return;
    
    try {
        const playerIds = Array.from(gameState.players);
        
        if (playerIds.length === 0) {
            gameState.channel.send('❌ 沒有玩家加入遊戲！');
            gameStates.delete(guildId);
            return;
        }
        
        // 獲取玩家對象
        const players = [];
        for (const playerId of playerIds) {
            const member = gameState.channel.guild.members.cache.get(playerId);
            if (member) {
                players.push(member.user);
            }
        }
        
        if (players.length === 0) {
            gameState.channel.send('❌ 無法獲取玩家資訊！');
            gameStates.delete(guildId);
            return;
        }
        
        // 打亂玩家順序
        const shuffledPlayers = shuffleArray([...players]);
        
        // 根據玩家人數分配角色
        const gameRoles = AVALON_ROLES.slice(0, players.length);
        const shuffledRoles = shuffleArray([...gameRoles]);
        
        // 創建角色分配
        const roleAssignments = {};
        for (let i = 0; i < shuffledPlayers.length; i++) {
            roleAssignments[shuffledPlayers[i].id] = shuffledRoles[i];
        }
        
        // 發送角色給每個玩家（私訊）
        await sendRolesToPlayers(shuffledPlayers, roleAssignments);
        
        // 發送特殊資訊（私訊）
        await sendSpecialInformation(shuffledPlayers, roleAssignments);
        
        // 在頻道中宣布遊戲開始（不透露任何角色資訊）
        const startEmbed = new EmbedBuilder()
            .setTitle('🎮 遊戲開始！')
            .setDescription(`遊戲已開始！共有 ${shuffledPlayers.length} 名玩家參與。\n所有角色已透過私訊分配完成。\n\n👥 **參與玩家：**\n${shuffledPlayers.map(player => player.displayName || player.username).join('\n')}`)
            .setColor('#00FF00')
            .setTimestamp();
        
        gameState.channel.send({ embeds: [startEmbed] });
        
        // 清理遊戲狀態
        gameStates.delete(guildId);
        
    } catch (error) {
        console.error('遊戲開始時發生錯誤:', error);
        gameState.channel.send('❌ 遊戲開始時發生錯誤，請稍後再試。');
        gameStates.delete(guildId);
    }
}

// 發送角色給玩家（私訊）
async function sendRolesToPlayers(players, roleAssignments) {
    for (const player of players) {
        try {
            const role = roleAssignments[player.id];
            const embed = new EmbedBuilder()
                .setTitle('🎭 你的角色')
                .setDescription(`你的角色是：**${role}**`)
                .setColor('#4169E1')
                .setTimestamp();
            
            await player.send({ embeds: [embed] });
            console.log(`成功發送角色 ${role} 給 ${player.displayName || player.username}`);
        } catch (error) {
            console.error(`無法發送角色給 ${player.tag}:`, error);
        }
    }
}

// 發送特殊資訊給特定角色（私訊）
async function sendSpecialInformation(players, roleAssignments) {
    // 建立角色到玩家的映射
    const roleToPlayer = {};
    for (const [playerId, role] of Object.entries(roleAssignments)) {
        roleToPlayer[role] = players.find(p => p.id === playerId);
    }
    
    // 給梅林發送莫甘娜、刺客、奧伯倫的玩家名字
    if (roleToPlayer['梅林']) {
        const evilPlayers = [];
        if (roleToPlayer['莫甘娜']) evilPlayers.push(roleToPlayer['莫甘娜'].displayName || roleToPlayer['莫甘娜'].username);
        if (roleToPlayer['刺客']) evilPlayers.push(roleToPlayer['刺客'].displayName || roleToPlayer['刺客'].username);
        if (roleToPlayer['奧伯倫']) evilPlayers.push(roleToPlayer['奧伯倫'].displayName || roleToPlayer['奧伯倫'].username);
        
        if (evilPlayers.length > 0) {
            const embed = new EmbedBuilder()
                .setTitle('🔮 梅林的洞察')
                .setDescription(`以下玩家散發著邪惡的氣息：\n${evilPlayers.join(', ')}`)
                .setColor('#800080')
                .setTimestamp();
            
            try {
                await roleToPlayer['梅林'].send({ embeds: [embed] });
                console.log(`成功發送梅林資訊`);
            } catch (error) {
                console.error('無法發送特殊資訊給梅林:', error);
            }
        }
    }
    
    // 給邪惡陣營發送隊友資訊
    const evilRoles = ['莫德雷德', '莫甘娜', '刺客'];
    for (const role of evilRoles) {
        if (roleToPlayer[role]) {
            const teammates = [];
            for (const otherRole of evilRoles) {
                if (otherRole !== role && roleToPlayer[otherRole]) {
                    teammates.push(roleToPlayer[otherRole].displayName || roleToPlayer[otherRole].username);
                }
            }
            
            if (teammates.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🗡️ 邪惡陣營')
                    .setDescription(`你的邪惡夥伴：\n${teammates.join(', ')}`)
                    .setColor('#FF0000')
                    .setTimestamp();
                
                try {
                    await roleToPlayer[role].send({ embeds: [embed] });
                    console.log(`成功發送邪惡陣營資訊給 ${role}`);
                } catch (error) {
                    console.error(`無法發送特殊資訊給 ${role}:`, error);
                }
            }
        }
    }
    
    // 給派希維爾發送梅林和莫甘娜的玩家名字
    if (roleToPlayer['派希維爾']) {
        const targets = [];
        if (roleToPlayer['梅林']) targets.push(roleToPlayer['梅林'].displayName || roleToPlayer['梅林'].username);
        if (roleToPlayer['莫甘娜']) targets.push(roleToPlayer['莫甘娜'].displayName || roleToPlayer['莫甘娜'].username);
        
        if (targets.length > 0) {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ 派希維爾的感知')
                .setDescription(`以下玩家擁有魔法力量：\n${targets.join(', ')}`)
                .setColor('#FFD700')
                .setTimestamp();
            
            try {
                await roleToPlayer['派希維爾'].send({ embeds: [embed] });
                console.log(`成功發送派希維爾資訊`);
            } catch (error) {
                console.error('無法發送特殊資訊給派希維爾:', error);
            }
        }
    }
}

// 打亂陣列函數
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 登錄機器人
client.login(process.env.DISCORD_TOKEN);
