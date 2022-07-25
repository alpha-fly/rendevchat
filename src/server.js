import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import express from "express";
import mysql from "mysql2";  
import ejs from "ejs";
import path from "path";
require("dotenv").config();

const app = express();

app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("index"));
app.get("/*", (req, res) => res.redirect("/"));

const httpServer = http.createServer(app);

// 502 Bad gateway 에러에 대한 대응: Idle timeout 값을 크게 잡아준다. (이것 만으로는 해결 안됐음)
// AWS ALB의 기본 Idle timeout 값은 60초. 아래와 같이 65, 66초로 잡아줌.
httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 66000;

const wsServer = new Server(httpServer, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true,
  },
});
instrument(wsServer, {
  auth: false,
});

// MySQL DB에 연결 (Pool)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: "root",
  password: process.env.DB_PASSWORD,
  database: "rendevSQL",  
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

wsServer.on("connection", (socket) => {
  // (1) 소켓 접속되면 일단 nickname 을 Anonymous로 디폴트 설정해줌
  socket["nickname"] = "상대방";

  // 모든 socket 이벤트에 대한 log 표시 (필요시에만 주석을 풀어 사용할 것)
  // socket.onAny((event) => {
  //     console.log(wsServer.sockets.adapter);
  //     console.log(`Socket Event : ${event}`)
  // });

  // (3-1) 입력된 interview code가 옳은지 검증한다 (DB의 application 테이블에 등록된 코드인가?)
  socket.on("check_code", (code) => {
   
    pool.getConnection(function(err, conn){
      conn.query(
        "SELECT interviewCode, schedule, status from application",
        (error, results) => {
          if (error) {
            console.log(error);
            pool.releaseConnection(conn);
          }

          // 입력받은 면접코드가 DB의 application 테이블의 interviewCode 칼럼에 등록된 코드인지 확인한다.
          const interview = results.find(
            (application) => application["interviewCode"] === code
          );
          
          if (!interview) {
            const errormessage = "인터뷰 코드가 바르지 않습니다.";
            socket.emit("wrong_code", errormessage);
            pool.releaseConnection(conn);
            return;
          }          
          console.log(interview);

          // -----( 7/16 MVP 시간조건 off )------- 인터뷰 예약시간 기준 "15분전 ~ 3시간 후" 사이일 때만 인터뷰 입장이 가능.        
          // const currentTime = new Date();          
          // const fifteenMinEarlier = new Date( (Date.parse(interview["schedule"])) - 1000 * 60 * 15 );
          // const threeHrslater = new Date( (Date.parse(interview["schedule"])) + 1000 * 60 * 60 * 3 );

          // console.log("현재시각 :", currentTime)
          // console.log("인터뷰시간:", interview["schedule"])
          // console.log("15분 전  :", fifteenMinEarlier)
          // console.log("3시간 후 :", threeHrslater)        

          // if (
          //   currentTime < fifteenMinEarlier ||
          //   currentTime > threeHrslater
          // ) {
          //   const errormessage =
          //     `인터뷰 예약시간 기준 "15분 전 ~ 3시간 후" 사이에만 입장 가능합니다.`;

          //-----( 7/16 MVP 시간조건 off )-----------------------------------------------

          // 위 두 조건을 모두 통과했다면 영상통화방으로 입장한다.
          socket.emit("right_code", code);
          // pool.releaseConnection(conn);
      })  
    });   
  });

  // (3-2) 전달받은 room name 으로 입장한다 (없는 경우 room 만들면서 입장)
  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit("welcome");
  });

  // 아래 offer, answer, ice : WebRTC peer-to-peer 연결을 위해 socket으로 시그널링

  // (5) offer 내용을 전달받고 같은 방에 offer를 보낸다.
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });

  // (7) answer의 내용을 전달받아 같은 방에 answer를 보낸다.
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });

  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });

  // 이하 text chat을 위한 socket 통신
  socket.on("new_message", (msg, roomName, done) => {
    console.log(socket.id);
    const socketId = socket.id
    socket.to(roomName).emit("new_message", msg, socketId);
    done();
  });

  socket.on("nickname", (nickname) => (socket["nickname"] = nickname));

  // 인터뷰 종료 버튼을 눌렀을 때 DB에 상태변화 적용해주기
  socket.on("finish_interview", (roomName) => {
    pool.getConnection(function(err, conn){
      pool.query(
        `SELECT interviewCode, status 
              from application
              WHERE interviewCode="${roomName}"`,
        (error, results) => {
          if (error) {
            console.log(error);
            pool.releaseConnection(conn);
          }
          console.log(results);

          // status가 finish(1)이나 finish(2)가 아닐 경우, finish(1)로 바꿔준다.
          if (
            results[0]["status"] !== "finish(1)" &&
            results[0]["status"] !== "finish(2)"
          ) {
            pool.query(
              `UPDATE application 
                        SET status="finish(1)" 
                        WHERE interviewCode="${roomName}"`,
              (error, results) => {
                if (error) {
                  console.log(error);
                  pool.releaseConnection(conn);
                }
              }
            );

          // status가 finish(1)이라면, finish(2)로 바꿔준다.
          } else if (results[0]["status"] == "finish(1)") {
            pool.query(
              `UPDATE application 
                        SET status="finish(2)" 
                        WHERE interviewCode="${roomName}"`,
              (error, results) => {
                if (error) {
                  console.log(error);
                  pool.releaseConnection(conn);
                }
              });
          }
        }
      )
      pool.releaseConnection(conn);
    });
  });  

  // socket.on("disconnecting", () => {
  //     socket.rooms.forEach((room) => socket.to(room).emit("bye", socket.nickname));
  // });

  // socket.on("disconnect", () => {
  //     wsServer.sockets.emit("room_change", publicRooms());
  // })
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
