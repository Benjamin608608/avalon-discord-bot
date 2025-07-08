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
let gameState = {
    isStarting: false,
    players: [],
    roleAssignments: {}
};

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

// 處理開始遊戲指令
async function handleStartCommand(message) {
    // 檢查是否已經有遊戲在進行
    if (gameState.isStarting) {
        message.reply('遊戲已經在進行中！請等待當前遊戲結束。');
        return;
    }
    
    // 重置遊戲狀態
    gameState.isStarting = true;
    gameState.players = [];
    gameState.roleAssignments = {};
    
    // 創建嵌入式訊息
    const embed = new EmbedBuilder()
        .setTitle('🏰 阿瓦隆遊戲開始！')
        .setDescription('請參與玩家按下 ➕ 表情符號加入遊戲\n⏰ 30秒後開始分配角色')
        .setColor('#FFD700')
        .setTimestamp();
    
    // 發送訊息並添加表情符號
    const gameMessage = await message.channel.send({ embeds: [embed] });
    await gameMessage.react('➕');
    
    // 30秒後開始遊戲
    setTimeout(async () => {
        await startGame(gameMessage, message.channel);
    }, 30000);
}

// 開始遊戲並分配角色
async function startGame(gameMessage, channel) {
    try {
        // 獲取所有按下表情符號的用戶
        const reaction = gameMessage.reactions.cache.get('➕');
        if (!reaction) {
            channel.send('❌ 沒有玩家加入遊戲！');
            gameState.isStarting = false;
            return;
        }
        
        // 收集所有按下表情符號的用戶（排除機器人）
        const users = await reaction.users.fetch();
        const players = users.filter(user => !user.bot);
        
        if (players.size === 0) {
            channel.send('❌ 沒有玩家加入遊戲！');
            gameState.isStarting = false;
            return;
        }
        
        if (players.size > 10) {
            channel.send('❌ 玩家人數過多！最多只能10人遊戲。');
            gameState.isStarting = false;
            return;
        }
        
        // 將玩家轉換為陣列並打亂順序
        const playerArray = Array.from(players.values());
        const shuffledPlayers = shuffleArray([...playerArray]);
        
        // 根據玩家人數分配角色
        const gamePlayers = shuffledPlayers.slice(0, players.size);
        const gameRoles = AVALON_ROLES.slice(0, players.size);
        const shuffledRoles = shuffleArray([...gameRoles]);
        
        // 創建角色分配
        const roleAssignments = {};
        for (let i = 0; i < gamePlayers.length; i++) {
            roleAssignments[gamePlayers[i].id] = shuffledRoles[i];
        }
        
        gameState.players = gamePlayers;
        gameState.roleAssignments = roleAssignments;
        
        // 發送角色給每個玩家（私訊）
        await sendRolesToPlayers(gamePlayers, roleAssignments);
        
        // 發送特殊資訊（私訊）
        await sendSpecialInformation(gamePlayers, roleAssignments);
        
        // 在頻道中宣布遊戲開始（不透露任何角色資訊）
        const startEmbed = new EmbedBuilder()
            .setTitle('🎮 遊戲開始！')
            .setDescription(`遊戲已開始！共有 ${gamePlayers.length} 名玩家參與。\n所有角色已透過私訊分配完成。\n\n👥 **參與玩家：**\n${gamePlayers.map(player => player.displayName).join('\n')}`)
            .setColor('#00FF00')
            .setTimestamp();
        
        channel.send({ embeds: [startEmbed] });
        
        // 重置遊戲狀態
        gameState.isStarting = false;
        
    } catch (error) {
        console.error('遊戲開始時發生錯誤:', error);
        channel.send('❌ 遊戲開始時發生錯誤，請稍後再試。');
        gameState.isStarting = false;
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
            console.log(`成功發送角色 ${role} 給 ${player.displayName}`);
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
        if (roleToPlayer['莫甘娜']) evilPlayers.push(roleToPlayer['莫甘娜'].displayName);
        if (roleToPlayer['刺客']) evilPlayers.push(roleToPlayer['刺客'].displayName);
        if (roleToPlayer['奧伯倫']) evilPlayers.push(roleToPlayer['奧伯倫'].displayName);
        
        if (evilPlayers.length > 0) {
            const embed = new EmbedBuilder()
                .setTitle('🔮 梅林的洞察')
                .setDescription(`以下玩家散發著邪惡的氣息：\n${evilPlayers.join(', ')}`)
                .setColor('#800080')
                .setTimestamp();
            
            try {
                await roleToPlayer['梅林'].send({ embeds: [embed] });
                console.log(`成功發送梅林資訊給 ${roleToPlayer['梅林'].displayName}`);
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
                    teammates.push(roleToPlayer[otherRole].displayName);
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
                    console.log(`成功發送邪惡陣營資訊給 ${roleToPlayer[role].displayName}`);
                } catch (error) {
                    console.error(`無法發送特殊資訊給 ${role}:`, error);
                }
            }
        }
    }
    
    // 給派希維爾發送梅林和莫甘娜的玩家名字
    if (roleToPlayer['派希維爾']) {
        const targets = [];
        if (roleToPlayer['梅林']) targets.push(roleToPlayer['梅林'].displayName);
        if (roleToPlayer['莫甘娜']) targets.push(roleToPlayer['莫甘娜'].displayName);
        
        if (targets.length > 0) {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ 派希維爾的感知')
                .setDescription(`以下玩家擁有魔法力量：\n${targets.join(', ')}`)
                .setColor('#FFD700')
                .setTimestamp();
            
            try {
                await roleToPlayer['派希維爾'].send({ embeds: [embed] });
                console.log(`成功發送派希維爾資訊給 ${roleToPlayer['派希維爾'].displayName}`);
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
