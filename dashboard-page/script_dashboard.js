// Biến toàn cục cho dữ liệu thiết bị
let deviceData = {
    battery: 0,
    heartRate: 0,
    spo2: 0,
    lastUpdate: null
};

// Thông tin kết nối MQTT
const mqttConfig = {
    host: '3d4f01052fa04a539a871f0ca82c4419.s1.eu.hivemq.cloud',
    port: 8884, // Port cho MQTT WebSockets Secure
    username: 'caodinhthi2003',
    password: 'Thi2k3er',
    clientId: 'dashboard_' + Math.random().toString(16).substring(2, 10)
};

let mqttClient = null;

// Kết nối với MQTT Broker
function connectMqtt() {
    const connectUrl = `wss://${mqttConfig.host}:${mqttConfig.port}/mqtt`;
    
    console.log('Đang kết nối đến MQTT Broker...');
    
    mqttClient = mqtt.connect(connectUrl, {
        clientId: mqttConfig.clientId,
        clean: true,
        username: mqttConfig.username,
        password: mqttConfig.password,
        useSSL: true
    });

    // Xử lý sự kiện kết nối
    mqttClient.on('connect', () => {
        console.log('Đã kết nối với MQTT Broker!');
        
        // Đăng ký nhận dữ liệu từ thiết bị
        mqttClient.subscribe('smartband/data', (err) => {
            if (err) {
                console.error('Không thể đăng ký topic:', err);
            } else {
                console.log('Đã đăng ký topic: smartband/data');
                
                // Hiển thị trạng thái đã kết nối
                document.getElementById('connection-status').textContent = 'Đã kết nối với HiveMQ';
                document.getElementById('connection-status').style.color = 'green';
            }
        });
    });

    // Xử lý tin nhắn nhận được
    mqttClient.on('message', (topic, message) => {
        console.log(`Nhận dữ liệu từ ${topic}: ${message.toString()}`);
        
        if (topic === 'smartband/data') {
            try {
                const data = JSON.parse(message.toString());
                
                // Cập nhật dữ liệu thiết bị
                deviceData.battery = data.battery;
                deviceData.heartRate = data.heartRate;
                deviceData.spo2 = data.spo2;
                deviceData.lastUpdate = new Date();
                
                // Cập nhật giao diện với dữ liệu mới
                updateWithRealData();
            } catch (error) {
                console.error('Lỗi khi xử lý dữ liệu:', error);
            }
        }
    });

    // Xử lý sự kiện lỗi
    mqttClient.on('error', (err) => {
        console.error('Lỗi kết nối MQTT:', err);
        document.getElementById('connection-status').textContent = 'Lỗi kết nối với HiveMQ';
        document.getElementById('connection-status').style.color = 'red';
    });
    
    // Xử lý mất kết nối
    mqttClient.on('offline', () => {
        console.log('Mất kết nối với MQTT Broker');
        document.getElementById('connection-status').textContent = 'Mất kết nối với HiveMQ';
        document.getElementById('connection-status').style.color = 'orange';
    });
}

// Cập nhật giao diện với dữ liệu thực
function updateWithRealData() {
    // Cập nhật thời gian nhận dữ liệu mới nhất
    const lastUpdateTime = deviceData.lastUpdate;
    document.getElementById('last-update').textContent = `Cập nhật lúc: ${lastUpdateTime.toLocaleTimeString()}`;
    
    // Cập nhật các chỉ số
    document.getElementById('battery').textContent = `Pin: ${deviceData.battery}%`;
    document.getElementById('bpm').textContent = `Nhịp tim: ${deviceData.heartRate} BPM`;
    document.getElementById('sp02').textContent = `SpO2: ${deviceData.spo2}%`;
    
    // Thêm vào bảng log
    addToLogTable();
}

function updateDateTime() {
    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const formattedTime = now.toLocaleTimeString();
    document.getElementById('datetime').textContent = `${formattedDate} ${formattedTime}`;
}

function addToLogTable() {
    const logTableBody = document.querySelector('#log-table tbody');

    // Lấy dữ liệu hiện tại
    const now = deviceData.lastUpdate;
    const time = `${now.toLocaleTimeString()} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    
    // Tạo hàng mới
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${time}</td>
        <td>${deviceData.heartRate}</td>
        <td>${deviceData.spo2}</td>
        <td>${deviceData.battery}</td>
    `;

    // Thêm hàng mới vào bảng
    logTableBody.prepend(newRow);

    // Giới hạn số hàng trong bảng là 5
    while (logTableBody.rows.length > 5) {
        logTableBody.deleteRow(-1);
    }
}

// Hàm cập nhật dashboard
function updateDashboard() {
    // Chỉ cập nhật ngày giờ hiện tại
    updateDateTime();
}

// Kết nối với MQTT khi trang web được tải
document.addEventListener('DOMContentLoaded', () => {
    // Kết nối MQTT
    connectMqtt();
    
    // Cập nhật ngày giờ mỗi giây
    setInterval(updateDashboard, 1000);
});