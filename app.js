// Firebase設定
const firebaseConfig = {
    // ここにFirebaseのコンフィグ情報を入力
    apiKey: "your-api-key",
    authDomain: "your-auth-domain",
    databaseURL: "your-database-url",
    projectId: "your-project-id",
    storageBucket: "your-storage-bucket",
    messagingSenderId: "your-messaging-sender-id",
    appId: "your-app-id"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let map;
let markers = [];
let isEditMode = true;
let currentMarker = null;

// マップの初期化
function initMap() {
    map = L.map('map').setView([35.6895, 139.6917], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // 現在地を取得して表示
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], 15);
                
                // 現在地マーカー
                L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        className: 'current-location',
                        html: '📍',
                        iconSize: [25, 25]
                    })
                }).addTo(map);
            },
            error => console.error('位置情報の取得に失敗しました:', error)
        );
    }

    // マップクリックイベント
    map.on('click', function(e) {
        if (isEditMode) {
            addBinMarker(e.latlng);
        }
    });

    // データベースからマーカーを読み込む
    loadMarkersFromDatabase();
}

// データベースからマーカーを読み込む
function loadMarkersFromDatabase() {
    database.ref('markers').on('value', (snapshot) => {
        // 既存のマーカーをクリア
        markers.forEach(({ marker }) => map.removeLayer(marker));
        markers = [];

        const data = snapshot.val();
        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                const marker = L.marker([value.lat, value.lng]).addTo(map);
                marker.bindPopup(createPopupContent(value.name));
                markers.push({ 
                    marker, 
                    name: value.name,
                    id: key 
                });

                if (isEditMode) {
                    marker.on('click', function(e) {
                        L.DomEvent.stopPropagation(e);
                        editMarker(marker);
                    });
                }
            });
        }
    });
}

// ゴミ箱マーカーの追加
function addBinMarker(latlng) {
    const name = document.getElementById('binName').value || 'ゴミ箱';
    
    // データベースに保存
    const newMarkerRef = database.ref('markers').push();
    newMarkerRef.set({
        lat: latlng.lat,
        lng: latlng.lng,
        name: name
    });

    document.getElementById('binName').value = ''; // 入力フィールドをクリア
}

// ポップアップコンテンツの作成
function createPopupContent(name, isEditing = false) {
    if (isEditMode && isEditing) {
        return `
            <div>
                <input type="text" value="${name}" id="editName">
                <button onclick="updateMarker()">更新</button>
                <button onclick="deleteMarker()">削除</button>
            </div>
        `;
    }
    return `<div>${name}</div>`;
}

// マーカーの編集
function editMarker(marker) {
    currentMarker = marker;
    const markerData = markers.find(m => m.marker === marker);
    marker.setPopupContent(createPopupContent(markerData.name, true));
    marker.openPopup();
}

// マーカーの更新
function updateMarker() {
    if (currentMarker) {
        const newName = document.getElementById('editName').value;
        const markerData = markers.find(m => m.marker === currentMarker);
        
        // データベースを更新
        database.ref(`markers/${markerData.id}`).update({
            name: newName
        });

        currentMarker.closePopup();
    }
}

// マーカーの削除
function deleteMarker() {
    if (currentMarker) {
        const markerData = markers.find(m => m.marker === currentMarker);
        
        // データベースから削除
        database.ref(`markers/${markerData.id}`).remove();
        
        map.removeLayer(currentMarker);
        markers = markers.filter(m => m.marker !== currentMarker);
        currentMarker = null;
    }
}

// モード切替
document.getElementById('toggleMode').addEventListener('click', function() {
    isEditMode = !isEditMode;
    document.getElementById('editControls').classList.toggle('hidden');
    
    markers.forEach(({ marker, name }) => {
        marker.setPopupContent(createPopupContent(name));
        if (isEditMode) {
            marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                editMarker(marker);
            });
        } else {
            marker.off('click');
        }
    });
    
    this.textContent = isEditMode ? '閲覧モードへ切替' : '編集モードへ切替';
});

// 初期化
window.onload = initMap; 