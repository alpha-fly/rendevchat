const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const finishBtn = document.getElementById("finish"); // 인터뷰 종료버튼
const camerasSelect = document.getElementById("cameras");

const call  = document.getElementById("call")
const chat  = document.getElementById("chat")
// const chat  = document.getElementById("ChatText")
// const chatLog  = document.getElementById("chatLog")


call.hidden = true;
chat.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

// 사용자의 카메라 장치(mediaDevices) 불러오기
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();        
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId
            option.innerText = camera.label
            if (currentCamera.label == camera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option)
        })        
    } catch (e) {
        console.log (e)
    }
}

// 사용자의 비디오 입력(media) 받아서 myStream 생성하기
async function getMedia(deviceId) {
    const initialConstraints = {
        audio : true,
        video : { facingMode : "user"}, 
    };

    const cameraConstraints = {
        audio : true, 
        video : {deviceId: { exact : deviceId}},
    }
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId? cameraConstraints : initialConstraints
            );            
            myFace.srcObject = myStream;
            if (!deviceId) {
                await getCameras();
            }
    } catch(e){
        console.log(e)
    }
}

// Mute 버튼 작동
function handleMuteClick () {    
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    if (!muted) {
        // document.getElementById("img").src = "../image/mute.svg";
        // 이미지 에셋 번달 받은 후 이미지 수정 예정
        muteBtn.innerText = "음소거"        
        muted = true;
    } else {
        
        muteBtn.innerText = "음켜기"        
        muted = false;
    }
}

// 카메라 on/off 작동
function handleCameraClick () {    
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
    if (cameraOff) {
        cameraBtn.innerText = "캠끄기"        
        cameraOff = false
    } else {
        cameraBtn.innerText = "캠켜기"        
        cameraOff = true
    }
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value)
    if (myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

// 인터뷰 종료 버튼 클릭시 : Video, Audio 끄고 종료 버튼 감추고 alert 띄워준다.
async function handleFinishInterview() {  
    finishBtn.hidden = true;
    myStream.getAudioTracks().forEach((track) => (track.enabled = false));
    myStream.getVideoTracks().forEach((track) => (track.enabled = false));
    alert("인터뷰 완료를 확인했습니다. 좋은 결과 기다릴게요 :)")
    socket.emit("finish_interview", roomName);  
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
// finishBtn.addEventListener("click", handleFinishInterview) // 인터뷰 종료 버튼에 이벤트 배정
camerasSelect.addEventListener("input", handleCameraChange);


// welcome Form (choose a room)
const welcome = document.getElementById("welcome")
const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true; 
    //form 태그 안의 내용물들을 숨기기 위해 추가한 코드 입니다.
    welcomeForm.hidden = true; 
    call.hidden = false;
    chat.hidden = false;

    const msgForm = chat.querySelector("#msg");
    msgForm.addEventListener("submit", handleMessageSubmit)  

    await getMedia();
    makeConnection();
};

function handleChange(e) {
    const test1 = document.getElementById("CodeInput1").value
    const test2 = document.getElementById("CodeInput2").value
    const test3 = document.getElementById("CodeInput3").value
    const test4 = document.getElementById("CodeInput4").value
    const test5 = document.getElementById("CodeInput5").value
    const test6 = document.getElementById("CodeInput6").value

    const testall = [test1, test2, test3, test4, test5, test6]
    return (testtwo = testall.join(''))
  }


// (2) interview code(room name)을 입력받고 join_room에 전달한다. 
async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    const handle = handleChange()
    socket.emit("check_code", handle );  
    roomName = handle
    input.value=""
}


socket.on("right_code", async (roomName) => {
    await initCall();
    socket.emit("join_room", roomName );                
});

socket.on("wrong_code", async (errormessage) => {
    alert(errormessage);
});

// 방 입장하기
welcomeForm.addEventListener("submit", handleWelcomeSubmit)

//socket code part 1 : 영상채팅용 socket 통신 (WebRTC peer-to-peer 연결을 위한 부분)

// (4) 방에 입장되었다. 시그널링을 시작함, offer의 내용을 만들어 서버에 보낸다. 
socket.on("welcome", async () => {
    const offer = await myPeerConnection.createOffer();    
    myPeerConnection.setLocalDescription(offer)
    console.log("sent the offer")
    socket.emit("offer", offer, roomName);
});

// (6) offer를 받았다. answer의 내용을 만들어 서버에 보낸다. 
socket.on("offer", async (offer) => {
    console.log("received the offer")
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer")
});

// (8) answer까지 받았다. remote description 을 생성한다. 
socket.on("answer", (answer) => {
    console.log("received the answer")
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", ice => {
    console.log("received candidate")
    myPeerConnection.addIceCandidate(ice);
})

//socket code part 2 : 텍스트 채팅 핸들링
function addMessage(message, socketId) {
    console.log(message, socketId)
    
    // const ul = chat.querySelector("ul")
    // const li = document.createElement("li")
    // li.innerText = message;
    // ul.appendChild(li);

    if (socketId === socket.Id) {
        let $msg = document.createElement('div')
        $msg.innerHTML = `<div class="myMsg msgEl"><span class="msg">${message}</span></div>`
        chatLog.appendChild($msg)
    }else {
        let $msg = document.createElement('div')
        $msg.innerHTML = `<div class="anotherMsg msgEl"><span class="anotherName">상대방</span><span class="msg">${message}</span></div>`
        chatLog.appendChild($msg)
    }
    chatLog.scrollTop(chatLog.scrollHeight - chatLog.clientHeight)
}

async function handleMessageSubmit(event) {
    event.preventDefault();
    const input = chat.querySelector("#msg input");
    const value = input.value
   
    socket.emit("new_message", input.value, roomName, () => {
        addMessage(value);    
    });
    input.value=""
}

socket.on("new_message", (msg, socketId) => {addMessage(msg, socketId)});

// socket.on("bye", (left, newCount) => {
//     const h3 = room.querySelector("h3");
//     h3.innerText = `Room ${roomName} (${newCount})`;
//     addMessage(`${left} left...`)
// })


// WebRTC Code
function makeConnection () {
    myPeerConnection = new RTCPeerConnection({

        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { 
                username: 'alphafly',
                credential: '1324',
                urls: [
                    'turn:3.34.42.87:3478?transport=tcp',
                    'turn:3.34.42.87:3478?transport=udp',                    
                    'turn:3.34.42.87:80?transport=tcp',
                    'turn:3.34.42.87:80?transport=udp',
                    'turns:3.34.42.87:443?transport=tcp',
                    'turns:3.34.42.87:5349?transport=tcp',
                    ] 
            }
        ]
    });
    myPeerConnection.addEventListener("icecandidate", handleIce)
    myPeerConnection.addEventListener("addstream", handleAddStream)
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce (data) {
    console.log("sent candidate")
    socket.emit("ice", data.candidate, roomName)    
}

function handleAddStream(data) {
    const peerFace = document.getElementById("peerFace");    
    peerFace.srcObject = data.stream    
}