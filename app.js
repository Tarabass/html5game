var express = require('express');
var app = express();
var server = require('http').createServer(app);

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

var SOCKET_LIST = {};

var Entity = function(x, y) {
	var self = {
		x: x,
		y: y
	}
	
	self.getDistance = function(pt) {
		return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2));
	}
	
	return self;
};

var MovingEntity = function(x, y) {
	var self = Entity(x, y);

	self.spdX = 0;
	self.spdY = 0;
	self.id = "";
	
	self.update = function() {
		self.updatePosition();
	}
	
	self.updatePosition = function() {
		self.x += self.spdX;
		self.y += self.spdY;

		for(var i in SpecialItem.list) {
			var specialItem = SpecialItem.list[i];
			
			if(self.getDistance(specialItem) < 32) {
				specialItem.toRemove = true;
			}
		}
	}
	
	return self;
};

var Player = function(id) {
	var self = MovingEntity(250, 250);
	
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
	self.bulletAngle = 0;
	self.maxSpd = 10;
	self.fiveBullets = false;
	self.sevenBullets = false;
	self.doubleSpeed = false;
	
	var super_update = self.update;
	
	self.update = function() {
		self.updateSpd();
		super_update();
		
		for(var i in SpecialItem.list) {
			var specialItem = SpecialItem.list[i];
			
			if(self.getDistance(specialItem) < 32) {
				self.fiveBullets = false;
				self.sevenBullets = false;
				self.doubleSpeed = false;
				switch(specialItem.type) {
					case 'FIVE_BULLETS':
						self.fiveBullets = true;
						setTimeout(function() {
							self.fiveBullets = false;
						}, 5000);
					case 'SEVEN_BULLETS':
						self.sevenBullets = true;
						setTimeout(function() {
							self.sevenBullets = false;
						}, 5000);
						break;
					case 'DOUBLE_SPEED':
						self.doubleSpeed = true;
						setTimeout(function() {
							self.doubleSpeed = false;
						}, 5000);
						break;
				}
			}
		}

		if(self.pressingAttack) {
			if(self.fiveBullets === true) {
				for(var i = -2; i <= 2; i++)
					self.shootBullet(i * 10 + self.buttonAngle);
			}
			// if player has special force he can shoot 7 bullets
			else if(self.sevenBullets === true) {
				for(var i = -3; i <= 3; i++)
					self.shootBullet(i * 10 + self.buttonAngle);
			}
			else {
				self.shootBullet(self.buttonAngle);
			}
		}
	}
	
	self.shootBullet = function(angle) {
		Bullet(self.x, self.y, self.id, angle);
	}
	
	self.updateSpd = function() {
		var spd = self.maxSpd * (self.doubleSpeed ? 2 : 1);
		
		if(self.pressingRight === true)
			self.spdX = spd;//self.maxSpd;
		else if(self.pressingLeft === true)
			self.spdX = -spd;//self.maxSpd;
		else
			self.spdX = 0;

		if(self.pressingUp === true)
			self.spdY = -spd;//self.maxSpd;
		else if(self.pressingDown === true)
			self.spdY = spd;//self.maxSpd;
		else
			self.spdY = 0;
	}
	
	Player.list[id] = self;
	
	return self;
}
Player.list = {};
Player.onConnect = function(socket) {
	var player = Player(socket.id);
	
	socket.on('keypress', function(data) {
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'buttonAngle')
			player.buttonAngle = data.state;
	});
	
	socket.emit('exposePlayerNumber', player.number);
};
Player.onDisconnect = function(socket) {
	delete Player.list[socket.id];
};
Player.update = function() {
	var pack = [];
	
	for(var i in Player.list) {
		var player = Player.list[i];
		
		player.update();
		pack.push({
			x: player.x,
			y: player.y,
			number: player.number
		});
	}
	
	return pack;
};

var Bullet = function(x, y, parent, angle) {
	var self = MovingEntity(x, y);
	
	self.id = Math.random();
	self.spdX = Math.cos(angle/180 * Math.PI) * 10;
	self.spdY = Math.sin(angle/180 * Math.PI) * 10;
	self.parent = parent;
	self.timer = 0;
	self.toResume = false;
	
	var super_update = self.update;
	
	self.update = function() {
		if(self.timer++ > 100)
			self.toRemove = true;
		
		super_update();
		
		for(var i in Player.list) {
			var p = Player.list[i];
			
			if(self.getDistance(p) < 32 && self.parent !== p.id) {
				// handle collision. ex: hp--;
				self.toRemove = true;
			}
		}
	}
	
	Bullet.list[self.id] = self;
	
	return self;
}
Bullet.list = {};
Bullet.update = function() {
	var pack = [];
	
	for(var i in Bullet.list) {
		var bullet = Bullet.list[i];
		
		bullet.update();
		
		if(bullet.toRemove === true)
			delete Bullet.list[i];
		else {
			pack.push({
				x: bullet.x,
				y: bullet.y
			});
		}
	}
	
	return pack;
};

var SpecialItem = function() {
	var min = 10;
	var max = 490;
	var x = randomIntFromInterval(min, max);
	var y = randomIntFromInterval(min, max);
	var self = Entity(x, y);
	
	self.id = Math.random();
	self.type = SpecialItem.types[randomIntFromInterval(0, SpecialItem.types.length - 1)];
	self.toRemove = false;
	
	SpecialItem.list[self.id] = self;
}
SpecialItem.list = {};
SpecialItem.update = function() {
	var pack = [];
	
	if(randomIntFromInterval(0, 100) === randomIntFromInterval(0, 100))
		SpecialItem();
	
	for(var i in SpecialItem.list) {
		var specialItem = SpecialItem.list[i];
		
		if(specialItem.toRemove === true)
			delete SpecialItem.list[i];
		else {
			pack.push({
				x: specialItem.x,
				y: specialItem.y,
				type: specialItem.type
			});
		}
	}
	
	return pack;
};
SpecialItem.types = ['FIVE_BULLETS', 'SEVEN_BULLETS', 'DOUBLE_SPEED'];

var USERS = {
	'Bob': 'asd',
	'Bob2': 'bob',
	'Bob3': 'ttt'
}

var isValidPassword = function(data, callback) {
	setTimeout(function() {
		callback(USERS[data.username] === data.password);
	}, 10);
}
var isUsernameTaken = function(data, callback) {
	setTimeout(function() {
		callback(USERS[data.username]);
	}, 10);
}

var addUser = function(data, callback) {
	setTimeout(function() {
		USERS[data.username] = data.password;
		callback();
	}, 10);
}

var io = require('socket.io')(server);
io.on('connection', function(socket) {
	SOCKET_LIST[socket.id] = socket;
	
	socket.on('signIn', function(data) {
		isValidPassword(data, function(res) {
			if(res) {
				Player.onConnect(socket);
				socket.emit('signInResponse', { success: true });
			}
			else {
				socket.emit('signInResponse', { success: false });
			}
		});
	});
	
	socket.on('signUp', function(data) {
		isUsernameTaken(data, function(res) {
			if(res) {
				socket.emit('signUpResponse', { success: false });
			}
			else {
				addUser(data, function() {
					socket.emit('signUpResponse', { success: true });
				});
			}
		});
	});
	
	socket.on('sendMessageToServer', function(data) {
		var playerName = "" + socket.id;
		
		for(var i in SOCKET_LIST)
			SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data);
	});
	
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
});

setInterval(function() {
	var pack = {
		players: Player.update(),
		bullets: Bullet.update(),
		specialItems: SpecialItem.update()
	}
	
	for(var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		
		socket.emit('newPositions', pack);
	}
}, 1000/25);

function randomIntFromInterval(min, max) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}

server.listen(2000);
console.log('Server started');