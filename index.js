const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages
    ]
});

const prefix = config.prefix;
const economy = new Map();
const levels = new Map();
const warns = new Map();
const afk = new Map();
const tickets = new Set();
const snipes = new Map();

client.on('ready', () => {
    console.log(`${client.user.tag} aktif!`);
    client.user.setActivity('!yardım | 100+ Komut', { type: 3 });
});

client.on('guildMemberAdd', async (member) => {
    if (config.serverSettings.welcomeChannelID) {
        const channel = member.guild.channels.cache.get(config.serverSettings.welcomeChannelID);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('Hoş Geldin! 👋')
                .setDescription(`${member} sunucumuza katıldı!\nŞu anda **${member.guild.memberCount}** kişiyiz!`)
                .setColor(config.colors.success)
                .setThumbnail(member.user.displayAvatarURL());
            channel.send({ embeds: [embed] });
        }
    }
    economy.set(member.id, config.economy.startBalance);
    levels.set(member.id, { xp: 0, level: 1 });
});

client.on('guildMemberRemove', async (member) => {
    if (config.serverSettings.leaveChannelID) {
        const channel = member.guild.channels.cache.get(config.serverSettings.leaveChannelID);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('Görüşürüz! 👋')
                .setDescription(`${member.user.tag} sunucudan ayrıldı.\nŞu anda **${member.guild.memberCount}** kişiyiz.`)
                .setColor(config.colors.error)
                .setThumbnail(member.user.displayAvatarURL());
            channel.send({ embeds: [embed] });
        }
    }
});

client.on('messageDelete', async (message) => {
    if (message.author.bot) return;
    snipes.set(message.channel.id, {
        content: message.content,
        author: message.author.tag,
        authorID: message.author.id,
        image: message.attachments.first()?.url || null,
        time: Date.now()
    });
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'help_menu') {
            const category = interaction.values[0];
            let embed = new EmbedBuilder().setColor(config.colors.primary);

            if (category === 'moderation') {
                embed.setTitle('⚙️ Moderasyon Komutları')
                    .setDescription('`at`, `yasakla`, `yasakkaldır`, `sustur`, `susturkaldır`, `sil`, `uyar`, `uyarılar`, `uyarısil`, `kilitle`, `kilitleaç`, `yavaşmod`, `yenile`, `rolver`, `rolal`, `kanalolustur`, `kanalsil`');
            } else if (category === 'fun') {
                embed.setTitle('🎮 Eğlence Komutları')
                    .setDescription('`zar`, `yazıtura`, `tokat`, `sarıl`, `öp`, `8ball`, `rastgele`, `ascii`, `tersten`, `şaka`, `gerçek`, `tavsiye`, `meme`');
            } else if (category === 'economy') {
                embed.setTitle('💰 Ekonomi Komutları')
                    .setDescription('`bakiye`, `günlük`, `çalış`, `suç`, `soy`, `gönder`, `slot`, `rulet`, `blackjack`, `market`, `satınal`, `envanter`, `kullan`');
            } else if (category === 'level') {
                embed.setTitle('📊 Seviye Sistemi')
                    .setDescription('`seviye`, `sıralama`, `liderlik`, `seviyeayarla`, `xpver`, `xpal`');
            } else if (category === 'ticket') {
                embed.setTitle('🎫 Ticket Sistemi')
                    .setDescription('`destek`, `kapat`, `ticketekle`, `ticketçıkar`, `ticketayarla`');
            } else if (category === 'settings') {
                embed.setTitle('🔧 Sunucu Ayarları')
                    .setDescription('`hoşgeldinayarla`, `ayrılmaayarla`, `logayarla`, `otorolayarla`, `prefixayarla`');
            } else if (category === 'info') {
                embed.setTitle('ℹ️ Bilgi Komutları')
                    .setDescription('`sunucubilgi`, `kullanıcıbilgi`, `avatar`, `banner`, `rolbilgi`, `kanalbilgi`, `emoji`, `sunucuicon`, `üyesayısı`');
            } else if (category === 'utility') {
                embed.setTitle('🛠️ Yardımcı Komutlar')
                    .setDescription('`hesapla`, `afk`, `çevir`, `kısalt`, `qr`, `şifre`, `renk`, `çekiliş`, `bitir`, `yenile`, `snipe`, `embedoluştur`');
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            const member = interaction.guild.members.cache.get(interaction.channel.name.split('-')[1]);
            if (member) tickets.delete(member.id);
            await interaction.reply('Ticket kapatılıyor...');
            setTimeout(async () => {
                await interaction.channel.delete();
            }, 3000);
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (afk.has(message.author.id)) {
        afk.delete(message.author.id);
        message.reply('AFK modundan çıktın!').then(m => setTimeout(() => m.delete(), 3000));
    }

    message.mentions.users.forEach(user => {
        if (afk.has(user.id)) {
            message.reply(`${user.tag} AFK: ${afk.get(user.id)}`);
        }
    });

    if (config.levels.enabled) {
        const userLevel = levels.get(message.author.id) || { xp: 0, level: 1 };
        userLevel.xp += Math.floor(Math.random() * config.levels.xpRandomBonus) + config.levels.xpPerMessage;
        const neededXp = userLevel.level * config.levels.levelUpMultiplier;
        if (userLevel.xp >= neededXp) {
            userLevel.level++;
            userLevel.xp = 0;
            message.reply(`Tebrikler! Seviye ${userLevel.level} oldun! 🎉`);
        }
        levels.set(message.author.id, userLevel);
    }

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'yardım' || command === 'help') {
        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_menu')
                    .setPlaceholder('Kategori seç')
                    .addOptions([
                        { label: '⚙️ Moderasyon', value: 'moderation', description: 'Moderasyon komutları' },
                        { label: '🎮 Eğlence', value: 'fun', description: 'Eğlence komutları' },
                        { label: '💰 Ekonomi', value: 'economy', description: 'Ekonomi komutları' },
                        { label: '📊 Seviye', value: 'level', description: 'Seviye sistemi' },
                        { label: '🎫 Ticket', value: 'ticket', description: 'Destek sistemi' },
                        { label: '🔧 Ayarlar', value: 'settings', description: 'Sunucu ayarları' },
                        { label: 'ℹ️ Bilgi', value: 'info', description: 'Bilgi komutları' },
                        { label: '🛠️ Utility', value: 'utility', description: 'Yardımcı komutlar' }
                    ])
            );

        const embed = new EmbedBuilder()
            .setTitle('📚 Komut Listesi')
            .setDescription('Aşağıdaki menüden kategori seçerek komutları görüntüleyebilirsin!\n\n**Toplam 100+ Komut**')
            .setColor(config.colors.primary)
            .addFields(
                { name: 'Prefix', value: `\`${prefix}\``, inline: true },
                { name: 'Toplam Komut', value: '100+', inline: true }
            )
            .setFooter({ text: `${message.author.tag} tarafından istendi`, iconURL: message.author.displayAvatarURL() });

        message.reply({ embeds: [embed], components: [row] });
    }

    if (command === 'ping') {
        const sent = await message.reply('Pong! 🏓');
        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Bot Gecikmesi', value: `${sent.createdTimestamp - message.createdTimestamp}ms`, inline: true },
                { name: 'API Gecikmesi', value: `${Math.round(client.ws.ping)}ms`, inline: true }
            )
            .setColor(config.colors.primary);
        sent.edit({ content: null, embeds: [embed] });
    }

    if (command === 'sunucubilgi' || command === 'serverinfo') {
        const embed = new EmbedBuilder()
            .setTitle(message.guild.name)
            .setThumbnail(message.guild.iconURL())
            .addFields(
                { name: '👑 Sahip', value: `<@${message.guild.ownerId}>`, inline: true },
                { name: '👥 Üyeler', value: `${message.guild.memberCount}`, inline: true },
                { name: '📊 Kanallar', value: `${message.guild.channels.cache.size}`, inline: true },
                { name: '🎭 Roller', value: `${message.guild.roles.cache.size}`, inline: true },
                { name: '📅 Oluşturulma', value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🆔 ID', value: message.guild.id, inline: true }
            )
            .setColor(config.colors.primary)
            .setFooter({ text: `Sunucu ID: ${message.guild.id}` });
        message.reply({ embeds: [embed] });
    }

    if (command === 'kullanıcıbilgi' || command === 'userinfo') {
        const user = message.mentions.users.first() || message.author;
        const member = message.guild.members.cache.get(user.id);
        const roles = member.roles.cache.filter(r => r.id !== message.guild.id).map(r => r).join(', ') || 'Rol yok';
        const embed = new EmbedBuilder()
            .setTitle(user.tag)
            .setThumbnail(user.displayAvatarURL({ size: 512 }))
            .addFields(
                { name: '🆔 ID', value: user.id, inline: true },
                { name: '📅 Hesap Oluşturma', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '📥 Sunucuya Katılma', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🎭 Roller', value: roles.length > 1024 ? 'Çok fazla rol' : roles, inline: false }
            )
            .setColor(member.displayHexColor || config.colors.primary);
        message.reply({ embeds: [embed] });
    }

    if (command === 'avatar' || command === 'pp') {
        const user = message.mentions.users.first() || message.author;
        const embed = new EmbedBuilder()
            .setTitle(`${user.tag} - Avatar`)
            .setImage(user.displayAvatarURL({ size: 4096 }))
            .setColor(config.colors.primary);
        message.reply({ embeds: [embed] });
    }

    if (command === 'banner') {
        const user = message.mentions.users.first() || message.author;
        const fetchedUser = await user.fetch();
        if (!fetchedUser.banner) return message.reply('Bu kullanıcının banner\'ı yok!');
        const embed = new EmbedBuilder()
            .setTitle(`${user.tag} - Banner`)
            .setImage(fetchedUser.bannerURL({ size: 4096 }))
            .setColor(config.colors.primary);
        message.reply({ embeds: [embed] });
    }

    if (command === 'at' || command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('❌ Yetkin yok!');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Bir üye etiketle!');
        if (!member.kickable) return message.reply('❌ Bu üyeyi atamam!');
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        await member.kick(reason);
        const embed = new EmbedBuilder()
            .setTitle('✅ Üye Atıldı')
            .addFields(
                { name: 'Atılan', value: member.user.tag, inline: true },
                { name: 'Atan', value: message.author.tag, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setColor(config.colors.error);
        message.reply({ embeds: [embed] });
    }

    if (command === 'yasakla' || command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('❌ Yetkin yok!');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Bir üye etiketle!');
        if (!member.bannable) return message.reply('❌ Bu üyeyi yasaklayamam!');
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        await member.ban({ reason });
        const embed = new EmbedBuilder()
            .setTitle('🔨 Üye Yasaklandı')
            .addFields(
                { name: 'Yasaklanan', value: member.user.tag, inline: true },
                { name: 'Yasaklayan', value: message.author.tag, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setColor(config.colors.error);
        message.reply({ embeds: [embed] });
    }

    if (command === 'yasakkaldır' || command === 'unban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('❌ Yetkin yok!');
        const userId = args[0];
        if (!userId) return message.reply('❌ Bir kullanıcı ID gir!');
        try {
            await message.guild.members.unban(userId);
            message.reply(`✅ <@${userId}> yasağı kaldırıldı!`);
        } catch (e) {
            message.reply('❌ Bu kullanıcı yasaklı değil!');
        }
    }

    if (command === 'sustur' || command === 'timeout' || command === 'mute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ Yetkin yok!');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Bir üye etiketle!');
        const duration = parseInt(args[1]) || 10;
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
        await member.timeout(duration * 60 * 1000, reason);
        const embed = new EmbedBuilder()
            .setTitle('🔇 Üye Susturuldu')
            .addFields(
                { name: 'Susturulan', value: member.user.tag, inline: true },
                { name: 'Süre', value: `${duration} dakika`, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setColor(config.colors.warning);
        message.reply({ embeds: [embed] });
    }

    if (command === 'susturkaldır' || command === 'untimeout' || command === 'unmute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ Yetkin yok!');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Bir üye etiketle!');
        await member.timeout(null);
        message.reply(`✅ ${member.user.tag} susturması kaldırıldı!`);
    }

    if (command === 'sil' || command === 'clear' || command === 'purge') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const amount = parseInt(args[0]);
        if (!amount || amount < 1 || amount > 100) return message.reply('❌ 1-100 arası sayı gir!');
        const messages = await message.channel.bulkDelete(amount + 1, true);
        message.channel.send(`✅ ${messages.size - 1} mesaj silindi!`).then(m => setTimeout(() => m.delete(), 3000));
    }

    if (command === 'uyar' || command === 'warn') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ Yetkin yok!');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Bir üye etiketle!');
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        const userWarns = warns.get(member.id) || [];
        userWarns.push({ reason, moderator: message.author.tag, date: new Date().toLocaleString('tr-TR') });
        warns.set(member.id, userWarns);
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Uyarı Verildi')
            .addFields(
                { name: 'Uyarılan', value: member.user.tag, inline: true },
                { name: 'Toplam Uyarı', value: `${userWarns.length}`, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setColor(config.colors.warning);
        message.reply({ embeds: [embed] });
        try {
            await member.send({ embeds: [embed] });
        } catch (e) {}
    }

    if (command === 'uyarılar' || command === 'warns') {
        const member = message.mentions.members.first() || message.member;
        const userWarns = warns.get(member.id) || [];
        if (userWarns.length === 0) return message.reply('✅ Bu kullanıcının uyarısı yok!');
        const embed = new EmbedBuilder()
            .setTitle(`⚠️ ${member.user.tag} - Uyarılar`)
            .setDescription(userWarns.map((w, i) => `**${i + 1}.** ${w.reason}\n*Yetkili: ${w.moderator} | Tarih: ${w.date}*`).join('\n\n'))
            .setColor(config.colors.warning);
        message.reply({ embeds: [embed] });
    }

    if (command === 'uyarısil' || command === 'clearwarns') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ Yetkin yok!');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Bir üye etiketle!');
        warns.delete(member.id);
        message.reply(`✅ ${member.user.tag} uyarıları temizlendi!`);
    }

    if (command === 'kilitle' || command === 'lock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ Yetkin yok!');
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        message.reply('🔒 Kanal kilitlendi!');
    }

    if (command === 'kilitleaç' || command === 'unlock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ Yetkin yok!');
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
        message.reply('🔓 Kanal kilidi açıldı!');
    }

    if (command === 'yavaşmod' || command === 'slowmode') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ Yetkin yok!');
        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0 || seconds > 21600) return message.reply('❌ 0-21600 arası saniye gir!');
        await message.channel.setRateLimitPerUser(seconds);
        message.reply(`⏱️ Yavaş mod ${seconds} saniye olarak ayarlandı!`);
    }

    if (command === 'yenile' || command === 'nuke') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ Yetkin yok!');
        const channel = message.channel;
        const position = channel.position;
        const newChannel = await channel.clone();
        await channel.delete();
        await newChannel.setPosition(position);
        const embed = new EmbedBuilder()
            .setTitle('💥 Kanal Yenilendi!')
            .setDescription('Bu kanal başarıyla yenilendi.')
            .setColor(config.colors.success);
        newChannel.send({ embeds: [embed] });
    }

    if (command === 'duyuru' || command === 'announce') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('❌ Yetkin yok!');
        const text = args.join(' ');
        if (!text) return message.reply('❌ Duyuru mesajı gir!');
        const embed = new EmbedBuilder()
            .setTitle('📢 DUYURU')
            .setDescription(text)
            .setColor(config.colors.warning)
            .setFooter({ text: `Duyuran: ${message.author.tag}` })
            .setTimestamp();
        message.delete();
        message.channel.send({ content: '@everyone', embeds: [embed] });
    }

    if (command === 'anket' || command === 'poll') {
        const question = args.join(' ');
        if (!question) return message.reply('❌ Soru gir!');
        const embed = new EmbedBuilder()
            .setTitle('📊 Anket')
            .setDescription(question)
            .setColor(config.colors.primary)
            .setFooter({ text: `Anketi oluşturan: ${message.author.tag}` });
        const msg = await message.channel.send({ embeds: [embed] });
        await msg.react('✅');
        await msg.react('❌');
        await msg.react('🤷');
    }

    if (command === 'embed' || command === 'gömülü') {
        const text = args.join(' ');
        if (!text) return message.reply('❌ Metin gir!');
        const embed = new EmbedBuilder()
            .setDescription(text)
            .setColor(config.colors.primary)
            .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL() });
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'söyle' || command === 'say') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const text = args.join(' ');
        if (!text) return message.reply('❌ Bir mesaj belirt!');
        message.delete();
        message.channel.send(text);
    }

    if (command === 'dm' || command === 'mesajat') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Bir kullanıcı etiketle!');
        const text = args.slice(1).join(' ');
        if (!text) return message.reply('❌ Mesaj gir!');
        try {
            await user.send(text);
            message.reply(`✅ ${user.tag} kullanıcısına DM gönderildi!`);
        } catch (e) {
            message.reply('❌ DM gönderilemedi!');
        }
    }

    if (command === 'destek' || command === 'ticket') {
        if (tickets.has(message.author.id)) return message.reply('❌ Zaten açık bir ticketın var!');
        const category = message.guild.channels.cache.find(c => c.name === config.serverSettings.ticketCategoryName && c.type === ChannelType.GuildCategory);
        const channel = await message.guild.channels.create({
            name: `ticket-${message.author.username}`,
            type: ChannelType.GuildText,
            parent: category?.id,
            permissionOverwrites: [
                { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
            ]
        });
        tickets.add(message.author.id);
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Ticket\'ı Kapat')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );
        const embed = new EmbedBuilder()
            .setTitle('🎫 Destek Talebi')
            .setDescription(`Merhaba ${message.author}!\n\nYetkili ekibimiz en kısa sürede seninle ilgilenecek.\nTicket\'ı kapatmak için aşağıdaki butona tıklayabilirsin.`)
            .setColor(config.colors.success)
            .addFields({ name: 'Açan', value: message.author.tag, inline: true })
            .setTimestamp();
        await channel.send({ content: `${message.author}`, embeds: [embed], components: [row] });
        message.reply(`✅ Ticket oluşturuldu: ${channel}`);
    }

    if (command === 'bakiye' || command === 'para' || command === 'balance') {
        const user = message.mentions.users.first() || message.author;
        const balance = economy.get(user.id) || 0;
        const embed = new EmbedBuilder()
            .setTitle('💰 Bakiye')
            .setDescription(`${user} bakiyesi: **${balance.toLocaleString('tr-TR')}** 💰`)
            .setColor(config.colors
if (command === 'günlük' || command === 'daily') {
        const userId = message.author.id;
        const amount = config.economy.dailyAmount;
        const current = economy.get(userId) || 0;
        economy.set(userId, current + amount);
        const embed = new EmbedBuilder()
            .setTitle('🎁 Günlük Ödül')
            .setDescription(`Günlük ödülünü aldın!\n\n**+${amount}** 💰`)
            .setColor(config.colors.success);
        message.reply({ embeds: [embed] });
    }

    if (command === 'çalış' || command === 'work') {
        const userId = message.author.id;
        const jobs = ['Yazılımcı', 'Doktor', 'Mühendis', 'Öğretmen', 'Aşçı', 'Pilot', 'Avukat', 'Polis'];
        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const amount = Math.floor(Math.random() * (config.economy.workMaxAmount - config.economy.workMinAmount)) + config.economy.workMinAmount;
        const current = economy.get(userId) || 0;
        economy.set(userId, current + amount);
        const embed = new EmbedBuilder()
            .setTitle('💼 Çalışma')
            .setDescription(`${job} olarak çalıştın ve **${amount}** 💰 kazandın!`)
            .setColor(config.colors.primary);
        message.reply({ embeds: [embed] });
    }

    if (command === 'suç' || command === 'crime') {
        const userId = message.author.id;
        const crimes = ['banka soymak', 'araba çalmak', 'hırsızlık yapmak', 'evden hırsızlık', 'market soymak'];
        const crime = crimes[Math.floor(Math.random() * crimes.length)];
        const success = Math.random() > 0.4;
        const amount = Math.floor(Math.random() * (config.economy.crimeMaxAmount - config.economy.crimeMinAmount)) + config.economy.crimeMinAmount;
        const current = economy.get(userId) || 0;
        if (success) {
            economy.set(userId, current + amount);
            message.reply(`✅ ${crime} başarılı! **+${amount}** 💰`);
        } else {
            economy.set(userId, Math.max(0, current - amount));
            message.reply(`❌ ${crime} başarısız! Yakalandın! **-${amount}** 💰`);
        }
    }

    if (command === 'soy' || command === 'rob') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Bir kullanıcı etiketle!');
        if (target.id === message.author.id) return message.reply('❌ Kendini soyamazsın!');
        const robberBal = economy.get(message.author.id) || 0;
        const targetBal = economy.get(target.id) || 0;
        if (robberBal < config.economy.robMinBalance) return message.reply(`❌ Soygun yapmak için en az ${config.economy.robMinBalance}💰 gerekli!`);
        if (targetBal < config.economy.robTargetMinBalance) return message.reply('❌ Bu kullanıcı çok fakir!');
        const success = Math.random() > 0.5;
        const amount = Math.floor(targetBal * 0.3);
        if (success) {
            economy.set(message.author.id, robberBal + amount);
            economy.set(target.id, targetBal - amount);
            message.reply(`✅ ${target} kullanıcısını soydun! **+${amount}** 💰`);
        } else {
            economy.set(message.author.id, robberBal - 200);
            message.reply(`❌ Soygun başarısız! Yakalandın! **-200** 💰`);
        }
    }

    if (command === 'gönder' || command === 'pay') {
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Bir kullanıcı etiketle!');
        if (user.id === message.author.id) return message.reply('❌ Kendine para gönderemezsin!');
        const amount = parseInt(args[1]);
        if (!amount || amount < 1) return message.reply('❌ Geçerli miktar gir!');
        const senderBalance = economy.get(message.author.id) || 0;
        if (senderBalance < amount) return message.reply('❌ Yetersiz bakiye!');
        economy.set(message.author.id, senderBalance - amount);
        const receiverBalance = economy.get(user.id) || 0;
        economy.set(user.id, receiverBalance + amount);
        message.reply(`✅ ${user.tag} kullanıcısına **${amount}** 💰 gönderildi!`);
    }

    if (command === 'slot' || command === 'slots') {
        const emojis = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
        const result = [emojis[Math.floor(Math.random() * 6)], emojis[Math.floor(Math.random() * 6)], emojis[Math.floor(Math.random() * 6)]];
        const isWin = result[0] === result[1] && result[1] === result[2];
        const userId = message.author.id;
        const bet = parseInt(args[0]) || 50;
        const current = economy.get(userId) || 0;
        if (current < bet) return message.reply('❌ Yetersiz bakiye!');
        if (isWin) {
            economy.set(userId, current + bet * 5);
            message.reply(`🎰 ${result.join(' | ')} - KAZANDIN! **+${bet * 5}** 💰`);
        } else {
            economy.set(userId, current - bet);
            message.reply(`🎰 ${result.join(' | ')} - KAYBETTİN! **-${bet}** 💰`);
        }
    }

    if (command === 'yazıtura' || command === 'coinflip' || command === 'cf') {
        const choice = args[0]?.toLowerCase();
        if (!['yazı', 'tura'].includes(choice)) return message.reply('❌ yazı veya tura seç!');
        const bet = parseInt(args[1]) || 50;
        const userId = message.author.id;
        const current = economy.get(userId) || 0;
        if (current < bet) return message.reply('❌ Yetersiz bakiye!');
        const result = Math.random() < 0.5 ? 'yazı' : 'tura';
        if (choice === result) {
            economy.set(userId, current + bet);
            message.reply(`🪙 ${result.toUpperCase()} - KAZANDIN! **+${bet}** 💰`);
        } else {
            economy.set(userId, current - bet);
            message.reply(`🪙 ${result.toUpperCase()} - KAYBETTİN! **-${bet}** 💰`);
        }
    }

    if (command === 'seviye' || command === 'level' || command === 'rank') {
        const user = message.mentions.users.first() || message.author;
        const userLevel = levels.get(user.id) || { xp: 0, level: 1 };
        const neededXp = userLevel.level * config.levels.levelUpMultiplier;
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${user.tag} - Seviye`)
            .addFields(
                { name: 'Seviye', value: `${userLevel.level}`, inline: true },
                { name: 'XP', value: `${userLevel.xp}/${neededXp}`, inline: true },
                { name: 'İlerleme', value: `${Math.floor((userLevel.xp / neededXp) * 100)}%`, inline: true }
            )
            .setColor(config.colors.primary)
            .setThumbnail(user.displayAvatarURL());
        message.reply({ embeds: [embed] });
    }

    if (command === 'sıralama' || command === 'leaderboard' || command === 'top') {
        const sortedLevels = Array.from(levels.entries()).sort((a, b) => b[1].level - a[1].level).slice(0, 10);
        const embed = new EmbedBuilder()
            .setTitle('🏆 Seviye Sıralaması')
            .setDescription(sortedLevels.map((entry, index) => {
                const user = client.users.cache.get(entry[0]);
                return `**${index + 1}.** ${user?.tag || 'Bilinmeyen'} - Seviye ${entry[1].level}`;
            }).join('\n'))
            .setColor(config.colors.primary);
        message.reply({ embeds: [embed] });
    }

    if (command === 'liderlik' || command === 'baltop') {
        const sortedEconomy = Array.from(economy.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const embed = new EmbedBuilder()
            .setTitle('💰 Para Sıralaması')
            .setDescription(sortedEconomy.map((entry, index) => {
                const user = client.users.cache.get(entry[0]);
                return `**${index + 1}.** ${user?.tag || 'Bilinmeyen'} - ${entry[1].toLocaleString('tr-TR')} 💰`;
            }).join('\n'))
            .setColor(config.colors.warning);
        message.reply({ embeds: [embed] });
    }

    if (command === 'rolver' || command === 'giverole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply('❌ Yetkin yok!');
        const member = message.mentions.members.first();
        const role = message.mentions.roles.first();
        if (!member || !role) return message.reply('❌ Üye ve rol etiketle!');
        await member.roles.add(role);
        message.reply(`✅ ${member.user.tag} kullanıcısına ${role.name} rolü verildi!`);
    }

    if (command === 'rolal' || command === 'removerole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply('❌ Yetkin yok!');
        const member = message.mentions.members.first();
        const role = message.mentions.roles.first();
        if (!member || !role) return message.reply('❌ Üye ve rol etiketle!');
        await member.roles.remove(role);
        message.reply(`✅ ${member.user.tag} kullanıcısından ${role.name} rolü alındı!`);
    }

    if (command === 'rolbilgi' || command === 'roleinfo') {
        const role = message.mentions.roles.first();
        if (!role) return message.reply('❌ Bir rol etiketle!');
        const embed = new EmbedBuilder()
            .setTitle(`🎭 ${role.name}`)
            .addFields(
                { name: 'ID', value: role.id, inline: true },
                { name: 'Renk', value: role.hexColor, inline: true },
                { name: 'Üye Sayısı', value: `${role.members.size}`, inline: true },
                { name: 'Oluşturulma', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'Sıralama', value: `${role.position}`, inline: true }
            )
            .setColor(role.hexColor);
        message.reply({ embeds: [embed] });
    }

    if (command === 'kanalolustur' || command === 'createchannel') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ Yetkin yok!');
        const channelName = args.join('-');
        if (!channelName) return message.reply('❌ Kanal adı gir!');
        await message.guild.channels.create({ name: channelName });
        message.reply(`✅ **${channelName}** kanalı oluşturuldu!`);
    }

    if (command === 'kanalsil' || command === 'deletechannel') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ Yetkin yok!');
        await message.channel.delete();
    }

    if (command === 'üyesayısı' || command === 'membercount') {
        const total = message.guild.memberCount;
        const online = message.guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
        const embed = new EmbedBuilder()
            .setTitle('👥 Üye Sayısı')
            .addFields(
                { name: 'Toplam', value: `${total}`, inline: true },
                { name: 'Çevrimiçi', value: `${online}`, inline: true }
            )
            .setColor(config.colors.primary);
        message.reply({ embeds: [embed] });
    }

    if (command === 'sunucuicon' || command === 'servericon') {
        const embed = new EmbedBuilder()
            .setTitle('🖼️ Sunucu İkonu')
            .setImage(message.guild.iconURL({ size: 4096 }))
            .setColor(config.colors.primary);
        message.reply({ embeds: [embed] });
    }

    if (command === 'afk') {
        const reason = args.join(' ') || 'AFK';
        afk.set(message.author.id, reason);
        message.reply(`✅ AFK oldun: **${reason}**`);
    }

    if (command === 'hesapla' || command === 'calc') {
        const expr = args.join('');
        if (!expr) return message.reply('❌ İşlem gir!');
        try {
            const result = eval(expr);
            message.reply(`🧮 **Sonuç:** ${result}`);
        } catch (e) {
            message.reply('❌ Geçersiz işlem!');
        }
    }

    if (command === 'zar' || command === 'roll') {
        const max = parseInt(args[0]) || 100;
        const result = Math.floor(Math.random() * max) + 1;
        message.reply(`🎲 **${result}** (1-${max})`);
    }

    if (command === '8ball') {
        const responses = ['Evet', 'Hayır', 'Belki', 'Kesinlikle', 'Asla', 'Muhtemelen', 'Sanmıyorum', 'Elbette', 'Tabii ki', 'Şüphesiz'];
        const response = responses[Math.floor(Math.random() * responses.length)];
        message.reply(`🎱 **${response}**`);
    }

    if (command === 'rastgele' || command === 'random') {
        const min = parseInt(args[0]) || 1;
        const max = parseInt(args[1]) || 100;
        const result = Math.floor(Math.random() * (max - min + 1)) + min;
        message.reply(`🎲 **${result}** (${min}-${max})`);
    }

    if (command === 'tokat' || command === 'slap') {
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Bir kullanıcı etiketle!');
        message.reply(`👋 ${message.author} ${user} kullanıcısına tokat attı!`);
    }

    if (command === 'sarıl' || command === 'hug') {
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Bir kullanıcı etiketle!');
        message.reply(`🤗 ${message.author} ${user} kullanıcısına sarıldı!`);
    }

    if (command === 'öp' || command === 'kiss') {
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Bir kullanıcı etiketle!');
        message.reply(`😘 ${message.author} ${user} kullanıcısını öptü!`);
    }

    if (command === 'tersten' || command === 'reverse') {
        const text = args.join(' ');
        if (!text) return message.reply('❌ Metin gir!');
        message.reply(text.split('').reverse().join(''));
    }

    if (command === 'ascii') {
        const text = args.join(' ');
        if (!text) return message.reply('❌ Metin gir!');
        const ascii = text.split('').map(c => c.charCodeAt(0)).join(' ');
        message.reply(`**ASCII:** ${ascii}`);
    }

    if (command === 'şaka' || command === 'joke') {
        const jokes = [
            'Neden bilgisayar doktora gitti? Virüs kaptı!',
            'Java geliştiricisi nereye gider? Java\'ya!',
            'Programcılar neden gözlük takar? C# göremezler!',
            'HTTP ve HTTPS birlikte bara gider, barmen sorar "GET mi yoksa POST mu?"',
            'Neden null ile undefined parti vermez? Çünkü tanımsız bir ilişkileri var!'
        ];
        message.reply(jokes[Math.floor(Math.random() * jokes.length)]);
    }

    if (command === 'gerçek' || command === 'fact') {
        const facts = [
            'Bal asla bozulmaz.',
            'Kutup ayıları sol pençeliler.',
            'Kelebekler ayaklarıyla tat alır.',
            'Venüs, Güneş sistemi\'ndeki en sıcak gezegen.',
            'Bir yıldırım 30,000°C sıcaklığa ulaşabilir.'
        ];
        message.reply(facts[Math.floor(Math.random() * facts.length)]);
    }

    if (command === 'tavsiye' || command === 'advice') {
        const advices = [
            'Asla pes etme!',
            'Her gün biraz daha iyi olmaya çalış.',
            'Kendine inan.',
            'Başkalarına yardım et.',
            'Hayallerinin peşinden git!'
        ];
        message.reply(advices[Math.floor(Math.random() * advices.length)]);
    }

    if (command === 'şifre' || command === 'password') {
        const length = parseInt(args[0]) || 12;
        if (length < 4 || length > 32) return message.reply('❌ 4-32 arası uzunluk gir!');
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        try {
            await message.author.send(`🔐 **Şifren:** ${password}`);
            message.reply('✅ Şifre DM olarak gönderildi!');
        } catch (e) {
            message.reply('❌ DM gönderilemedi!');
        }
    }

    if (command === 'snipe') {
        const data = snipes.get(message.channel.id);
        if (!data) return message.reply('❌ Son silinen mesaj bulunamadı!');
        const embed = new EmbedBuilder()
            .setAuthor({ name: data.author, iconURL: client.users.cache.get(data.authorID)?.displayAvatarURL() })
            .setDescription(data.content || 'Metin yok')
            .setFooter({ text: `${Math.floor((Date.now() - data.time) / 1000)} saniye önce` })
            .setColor(config.colors.primary);
        if (data.image) embed.setImage(data.image);
        message.reply({ embeds: [embed] });
    }

    if (command === 'çekiliş' || command === 'giveaway') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('❌ Yetkin yok!');
        const duration = parseInt(args[0]);
        const winners = parseInt(args[1]) || 1;
        const prize = args.slice(2).join(' ');
        if (!duration || !prize) return message.reply('❌ Kullanım: !çekiliş <süre(dk)> <kazanan> <ödül>');
        const embed = new EmbedBuilder()
            .setTitle('🎉 ÇEKİLİŞ')
            .setDescription(`**Ödül:** ${prize}\n**Kazanan:** ${winners} kişi\n**Süre:** ${duration} dakika\n\nKatılmak için 🎉 emojisine tıkla!`)
            .setColor(config.colors.success)
            .setFooter({ text: 'Çekiliş' })
            .setTimestamp(Date.now() + duration * 60000);
        const msg = await message.channel.send({ embeds: [embed] });
        await msg.react('🎉');
    }

    if (command === 'renk' || command === 'color') {
        const color = args[0] || '#' + Math.floor(Math.random()*16777215).toString(16);
        const embed = new EmbedBuilder()
            .setTitle('🎨 Renk')
            .setDescription(`**Hex:** ${color}`)
            .setColor(color);
        message.reply({ embeds: [embed] });
    }

    if (command === 'hoşgeldinayarla' || command === 'setwelcome') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('❌ Yetkin yok!');
        config.serverSettings.welcomeChannelID = message.channel.id;
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 4));
        message.reply('✅ Hoş geldin kanalı ayarlandı!');
    }

    if (command === 'ayrılmaayarla' || command === 'setleave') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('❌ Yetkin yok!');
        config.serverSettings.leaveChannelID = message.channel.id;
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 4));
        message.reply('✅ Ayrılma kanalı ayarlandı!');
    }

    if (command === 'emoji' || command === 'emote') {
        const emoji = args[0];
        if (!emoji) return message.reply('❌ Emoji gir!');
        const match = emoji.match(/<a?:\w+:(\d+)>/);
        if (!match) return message.reply('❌ Geçerli emoji gir!');
        const url = `https://cdn.discordapp.com/emojis/${match[1]}.${emoji.startsWith('<a:') ? 'gif' : 'png'}`;
        const embed = new EmbedBuilder()
            .setTitle('😀 Emoji')
            .setImage(url)
            .setColor(config.colors.primary);
        message.reply({ embeds: [embed] });
    }

    if (command === 'embedoluştur' || command === 'createembed') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const title = args.slice(0, args.indexOf('|')).join(' ');
        const description = args.slice(args.indexOf('|') + 1).join(' ');
        if (!title || !description) return message.reply('❌ Kullanım: !embedoluştur <başlık> | <açıklama>');
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(config.colors.primary)
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'kapat' || command === 'close') {
        if (!message.channel.name.startsWith('ticket-')) return message.reply('❌ Bu bir ticket kanalı değil!');
        const userId = message.guild.members.cache.find(m => message.channel.name === `ticket-${m.user.username}`)?.id;
        if (userId) tickets.delete(userId);
        await message.reply('🔒 Ticket kapatılıyor...');
        setTimeout(() => message.channel.delete(), 3000);
    }

    if (command === 'botbilgi' || command === 'stats') {
        const embed = new EmbedBuilder()
            .setTitle('📊 Bot İstatistikleri')
            .addFields(
                { name: 'Sunucular', value: `${client.guilds.cache.size}`, inline: true },
                { name: 'Kullanıcılar', value: `${client.users.cache.size}`, inline: true },
                { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: 'Çalışma Süresi', value: `${Math.floor(client.uptime / 3600000)} saat`, inline: true }
            )
            .setColor(config.colors.primary)
            .setThumbnail(client.user.displayAvatarURL());
        message.reply({ embeds: [embed] });
    }

    if (command === 'davet' || command === 'invite') {
        message.reply(`🔗 Botu sunucuna ekle: https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`);
    }

    if (command === 'uptime' || command === 'çalışmasüresi') {
        const uptime = client.uptime;
        const days = Math.floor(uptime / 86400000);
        const hours = Math.floor(uptime / 3600000) % 24;
        const minutes = Math.floor(uptime / 60000) % 60;
        const seconds = Math.floor(uptime / 1000) % 60;
        message.reply(`⏰ **Çalışma Süresi:** ${days}g ${hours}s ${minutes}d ${seconds}sn`);
    }

    if (command === 'temizle' || command === 'wipe') {
        if (message.author.id !== config.ownerID) return message.reply('❌ Sadece bot sahibi kullanabilir!');
        economy.clear();
        levels.clear();
        warns.clear();
        message.reply('✅ Tüm veriler temizlendi!');
    }
});

client.login(config.token);
