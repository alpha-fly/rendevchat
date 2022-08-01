const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
// const finishBtn = document.getElementById("finish"); // 인터뷰 종료버튼

const call = document.getElementById("call");
const chat = document.getElementById("chat");

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
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label == camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

// 사용자의 비디오 입력(media) 받아서 myStream 생성하기
async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" },
  };

  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

// Mute 버튼 작동
function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    const micOn = '<img src = "/public/js/image/micOff.svg">';
    muteBtn.innerHTML = micOn;
    muted = true;

  } else {
    const micoff = '<img src = "/public/js/image/micOn.svg">';
    muteBtn.innerHTML = micoff;
    muted = false;
  }
}

// 카메라 on/off 작동
function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    const camOn = '<img src = "/public/js/image/camon.svg">';
    cameraBtn.innerHTML = camOn;
    cameraOff = false;

  } else {
    const camOff = '<img src = "/public/js/image/camoff.svg">';
    cameraBtn.innerHTML = camOff;
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

// (기능 삭제함)인터뷰 종료 버튼 클릭시 : Video, Audio 끄고 종료 버튼 감추고 alert 띄워준다
// 해당 기능을 영상통화가 아닌, 메인 서비스의 "내 모집현황"에서 처리하기로 했으므로 기능 제외합니다.
// async function handleFinishInterview() {
//     finishBtn.hidden = true;
//     myStream.getAudioTracks().forEach((track) => (track.enabled = false));
//     myStream.getVideoTracks().forEach((track) => (track.enabled = false));
//     alert("인터뷰 완료를 확인했습니다. 좋은 결과 기다릴게요 :)")
//     socket.emit("finish_interview", roomName);
// }

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);
// finishBtn.addEventListener("click", handleFinishInterview) // 인터뷰 종료 버튼에 이벤트 배정

// welcome Form (choose a room)
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  welcome.hidden = true;
  //form 태그 안의 내용물들을 숨기기 위해 추가한 코드 입니다.
  welcomeForm.hidden = true;
  call.hidden = false;
  chat.hidden = false;

  const msgForm = chat.querySelector("#msg");
  msgForm.addEventListener("submit", handleMessageSubmit);

  try {
    await getMedia();
    makeConnection();
  } catch (error) {
    console.log(error);
    return;
  }
}

function handleChange(e) {
  const test1 = document.getElementById("CodeInput1").value;
  const test2 = document.getElementById("CodeInput2").value;
  const test3 = document.getElementById("CodeInput3").value;
  const test4 = document.getElementById("CodeInput4").value;
  const test5 = document.getElementById("CodeInput5").value;
  const test6 = document.getElementById("CodeInput6").value;

  const testall = [test1, test2, test3, test4, test5, test6];
  return (testtwo = testall.join(""));
}

// (1) interview code(room name)을 입력받고 check_code에 전달한다.
async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  const handle = handleChange();
  socket.emit("check_code", handle);
  roomName = handle;
  input.value = "";
}

// (3-1) 알맞은 interview code 라면 인터뷰 방에 입장하도록 한다.
// initCall 함수를 따라가면 getMedia 함수와 makeConnection 함수가 있다.
// 사용자의 카메라 정보를 읽어 자신의 미디어스트림을 형성하며, 
// 자신의 <PeerConnection을 생성>하여 그 안에 미디어스트림을 담는다. 
socket.on("right_code", async (roomName) => {
  await initCall();
  socket.emit("join_room", roomName);
});

// (3-2) interview code가 틀리거나 시간이 맞지 않는 경우 에러 메시지 반환.
socket.on("wrong_code", async (errormessage) => {
  alert(errormessage);
});

// 방 입장하기
welcomeForm.addEventListener("submit", handleWelcomeSubmit);

//socket code part 1 : 영상채팅용 socket 통신 (WebRTC peer-to-peer 연결을 위한 부분)

// (5) 방에 입장되었다. 시그널링을 시작함, 
// 자신의 <PeerConnection>의 정보로 offer의 내용을 만들어 서버에 보낸다.
socket.on("welcome", async () => {
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

// (7) offer를 받았다. answer의 내용을 만들어 서버에 보낸다.
socket.on("offer", async (offer) => {
  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

// (9) answer까지 받았다. remote description 을 생성한다.
socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

// 방 입장시 실행되는 함수의 연계 initCall - makeConnection - handleIce 순서를 따라가면
// ice candidate 교환 과정을 볼 수 있다. (socket.emit "ice"는 handleIce 함수 내에 있음)
socket.on("ice", (ice) => {
  console.log("received candidate");
  myPeerConnection.addIceCandidate(ice);
});

//socket code part 2 : 텍스트 채팅 핸들링
function addMessage(message, socketId) {
  console.log(message, socketId);

  if (socketId === socket.id) {
    let $msg = document.createElement("div");
    $msg.innerHTML = `<div class="myMsg msgEl"><span class="msg">${message}</span></div>`;
    chatLog.appendChild($msg);
  } else {
    let $msg = document.createElement("div");
    $msg.innerHTML = `<div class="anotherMsg msgEl"><span class="msg">${message}</span></div>`;
    chatLog.appendChild($msg);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function handleMessageSubmit(event) {
  event.preventDefault();
  const input = chat.querySelector("#msg input");
  const value = input.value;

  socket.emit("new_message", input.value, roomName, () => {
    addMessage(value, socket.id);
  });
  input.value = "";
}

socket.on("new_message", (msg, socketId) => {
  addMessage(msg, socketId);
});

socket.on("bye", (socketId) => {
  console.log (socketId, socket.id);
  if (socketId !== socket.id) {    
    peerFace.srcObject = null;
  }


});

// WebRTC Code
// 아래 iceServers 설정 내에 직접 coturn을 사용하여 세팅한 TURN 서버 주소 및 정보를 입력했음.
function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        username: "alphafly",
        credential: "1324",
        urls: [
          "turn:3.34.42.87:3478?transport=tcp",
          "turn:3.34.42.87:3478?transport=udp",
          "turn:3.34.42.87:80?transport=tcp",
          "turn:3.34.42.87:80?transport=udp",
          "turns:3.34.42.87:443?transport=tcp",
          "turns:3.34.42.87:5349?transport=tcp",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.stream;
}
