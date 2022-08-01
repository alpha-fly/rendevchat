# renDev Interview 

![KakaoTalk_20220801_104018630](https://user-images.githubusercontent.com/99331753/182059737-b4fe3025-ff23-4420-9d92-3f3b7e4ccd0f.png)
<br><br>

## Preview

![rendevchat_preview](https://user-images.githubusercontent.com/99331753/182060259-c2378b25-c00c-4fb5-a8f4-40c674f8741c.jpg)
<br><br>

## 목차 
1. renDev 서비스 소개
2. renDev Interview 소개
3. 사용 기술 목록
4. 트러블 슈팅

<br>
<br>

## 1. renDev 서비스 소개
renDev 서비스 바로가기 [https://rendev99.com] <br>
* renDev는 "포트폴리오를 준비하는 개발자 및 디자이너를 위한 협업 프로젝트 매칭 서비스" 입니다. 
* 프로젝트 아이디어는 있는데 혼자서 하기엔 버거울 때,
팀 프로젝트에 참여할 의욕은 있지만 아이디어가 마땅치 않을 때.
renDev에서 마음에 맞는 프로젝트와 팀원을 만나 보세요 🙂

<br>

renDev 브로셔 페이지 [https://www.notion.so/renDev-b4158b77a39343feab8a22ef0fa3e30c] <br>

* renDev는 웹개발자 교육 부트캠프 "항해99"의 최종 과정인 <실전 프로젝트>의 결과물입니다. 저희는 7기 B반 2조입니다 :)
* **위 브로셔 페이지 링크에서 상세한 서비스 설명 및 팀원 정보를 확인하실 수 있습니다.** 


<br>
<br>

## 2. renDev Interview 소개
renDev Interview 바로가기 [https://rendev.click]
* renDev Interview는 개발자를 위한 프로젝트 매칭 서비스 renDev의 하위 기능으로서, 영상통화 및 텍스트 채팅을 통한 인터뷰 기능을 제공합니다.
* 아무하고나 프로젝트하지 않는다! 프로젝트 협업을 위해 팀으로 모이기 전에 서로에 대해 미리 알아보는 시간을 가져보기 위함입니다.
* 인터뷰 기능 이용을 위해서는 renDev 메인 서비스[https://rendev99.com] 에서 인터뷰 예약을 하고 인터뷰 코드를 발급받아야 입장할 수 있습니다. 
* 인터뷰 예약시간을 기준으로 "15분전 ~ 3시간 후" 에만 인터뷰 입장이 가능하게 설계했습니다만, 현재 자유로운 유저 테스트를 위해 해당 제한은 해제해 두었습니다.

<br>
<br>


## 3. 사용 기술 목록

| 사용기술 | 기술 설명 |
|----------|:-------------|
| socket.io |  인터뷰 기능의 텍스트채팅 및 WebRTC 영상통화를 위한 시그널링, Room 기능을 통한 인터뷰 방 관리에 활용 |
| WebRTC | 영상통화 기능의 구현, Kurento나 openVidu 등을 사용하지 않고 WebRTC의 기본 기능으로 해결 |
| coturn | 공개 STUN/TURN 서버들의 안정성이 낮아, coturn을 활용하여 자체적으로 TURN 서버 구축 | 

<br>
<br>

## 4. 트러블 슈팅 (자체 TURN 서버 구축)
`요구사항`

WebRTC를 통한 영상통화 기능을 구현하기 위해, Peer to Peer 연결 및 중계 전송을 담당해줄 STUN/TURN 서버를 설정해야 함. STUN/TURN 서버 설정이 미흡하거나 설정한 서버가 제대로 동작하지 않는 경우 ICE candidate 교환에 실패하며 사용자간 mediaStream 교환이 이루어질 수 없음.
<br><br>

`선택지`

1안) 공개된 STUN/TURN 서버를 사용함 (예: Google STUN 서버 등)

2안) 유료 TURN 서버 서비스를 활용함 (예: [https://xirsys.com](https://xirsys.com/))

3안) PeerJS 또는 Kurento, openVidu 등의 외부 기술을 도입하여 해결함

**4안) 자체적으로 TURN 서버를 구성하여 관리함 (채택)** 
<br><br>

`대안 검토`

1. 공개 STUN/TURN 서버들은 연결 불안정성이 높으며, 특히 NAT을 이용하는 사용자가 거의 대다수이므로 반드시 TURN 서버를 활용하는 것이 좋은데 무료 TURN 서버는 찾기가 더욱 어려움(구글의 경우 STUN 서버는 유지하나 TURN 서버 지원이 종료된 것으로 파악됨). 
2. 유료 TURN 서버의 경우 가격이 저렴하지 않았으며, 프로젝트 기간 중 얼마나 많은 비용이 청구될지 가늠할 수 없어 제한된 예산에서 이 기능에 비용을 지출하는 것이 좋지 않다고 판단.
3. PeerJS나 Kurento를 사용하기 위해 해당 라이브러리 활용법을 새로 익히는 것은 효율적이지 않다 판단했으며, 특히 Kurento/openVidu는 대부분의 설정을 자동으로 구성해주는 대신에 세세한 기능의 구현에서 제약이 따를 것으로 판단함. 
<br><br>

`결정`

coturn 라이브러리를 활용하면 매우 쉽게 EC2 인스턴스에 TURN 서버를 구축할 수 있음을 확인하고 이대로 구현함. 안정적인 영상통화 기능의 구현이 이루어진 것으로 확인하였음.
<br>
<br>

* coturn 라이브러리 바로가기 [https://github.com/coturn/coturn] 
* coturn 설정 방법 참고 [https://kostya-malsev.medium.com/set-up-a-turn-server-on-aws-in-15-minutes-25beb145bc77]
