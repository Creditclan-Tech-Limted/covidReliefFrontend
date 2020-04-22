import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnChanges,
  Input,
  SimpleChanges,
  OnDestroy,
  Output,
  EventEmitter
} from "@angular/core";
import { Message, checkDOBResponse } from "../../models/message";
import { GeneralService } from "src/app/services/generalService/general.service";
import { ChatService } from "src/app/services/ChatService/chat.service";
// import { QuestionsToAsk, Questionaire } from "src/app/models/Questionaire";
import { TitleCasePipe } from "@angular/common";
import { Subscription } from "rxjs";
import { ValidateRefResponse } from "../../models/validaterRefRes";
import { delay } from "rxjs/operators";
import {
  replyGiversOrReceivers,
  GiverResponse,
  ReceiversResponse
} from "src/app/models/GiverResponse";
import { Router, NavigationStart, NavigationEnd } from "@angular/router";
// import { connectableObservableDescriptor } from 'rxjs/internal/observable/ConnectableObservable';

interface GetBvnResponse {
  text?: string;
  status?: boolean;
}

interface Trash {
  reset?: Subscription;
  apiCall?: Subscription;
  displayResponse?: Subscription;
  preventDisabling?: Subscription;
  specialCases?: Subscription;
  destroyNextReply?: Subscription;
}
@Component({
  selector: "app-chat-messages-display",
  templateUrl: "./chat-messages-display.component.html",
  styleUrls: ["./chat-messages-display.component.css"]
})
export class ChatMessagesDisplayComponent
  implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input("messages") messages: string | Object | GetBvnResponse;
  // lets come back to this input property later!
  @Input("referenceNumberInMsg") referenceNumberInMsg: any;
  @ViewChild("messagesPlaceHolder")
  messagePlaceHolder: ElementRef;
  @Output("restartProcess")
  restartProcess = new EventEmitter<string>();
  @Output("actionDispatched") actionDispatched = new EventEmitter<string>();
  observer: MutationObserver;
  // private counter: number;
  private refNo: string;
  private receiverIsPresent: boolean = false;

  public count: number = 0;
  observableToTrash: Trash = {};
  constructor(
    private generalservice: GeneralService,
    private chatservice: ChatService,
    private titleCasePipe: TitleCasePipe,
    private route: Router
  ) {}

  ngOnInit() {
    this.generalservice.congratsOrRegrets$.subscribe(val => {
      if (val.length < 1) {
        return;
      }
      if (val.toLowerCase() == "cancelled") {
        this.generateFailedRequestMsg(this.messagePlaceHolder.nativeElement);
      } else {
        this.generateSuccessfulSubmissionOfRequestMsg(
          this.messagePlaceHolder.nativeElement
        );
      }
    });

    this.observableToTrash.displayResponse = this.generalservice.intermediateResponse$.subscribe(
      (val: ReceiversResponse | GiverResponse) => {
        // console.log(val);
        const objCopy: ReceiversResponse & object | GiverResponse & object = {
          ...val
        };
        if (val instanceof ReceiversResponse) {
          if (
            objCopy.hasOwnProperty(
              "messageForUserToDisplayInResponseToPreviousStage"
            )
          ) {
            this.responseFromReceiver(objCopy as ReceiversResponse);
            // this.responseFromGiver({ message, text }, reply);
          }
          return;
        }
        if (val instanceof replyGiversOrReceivers) {
          this.insertGiversResponseIntoDom(
            val,
            this.generalservice.nextChatbotReplyToGiver
          );
        }
      }
    );

    this.observableToTrash.preventDisabling = this.generalservice.preventDisablingOfButtons$.subscribe(
      val => {
        if (val == "prevent") {
          return;
        } else if ("allow") {
          this.disableTheButtonsOfPreviousListElement();
        }
      }
    );

    this.observableToTrash.destroyNextReply = this.generalservice.nextReply$
      .pipe(delay(500))
      .subscribe(val => {
        let obj = new Object();
        // console.log(val);
        // obj = { ...val };
        if (!obj.hasOwnProperty("message")) return;
        // console.log(val);
        // this.respondToUsers(val);
      });
  }

  ngOnChanges(messages: SimpleChanges) {
    // console.log(messages.referenceNumberInMsg);
    const msg = { ...messages.messages };
    if (msg.currentValue) {
      // console.log(msg.currentValue);
      this.displaySubsequentMessages({
        message: msg.currentValue.message,
        direction: msg.currentValue.direction,
        button: !msg.currentValue.button ? null : msg.currentValue.button
      });
    }
  }

  ngAfterViewInit(message?: string, direction?: string) {
    const ul = this.messagePlaceHolder.nativeElement as HTMLUListElement;
    this.generateWelcomeMsgForReceiverOrGiver(ul);

    ul.addEventListener("customReceiverEventFromMsgClass", (e: CustomEvent) => {
      const { stage } = e.detail;
      if (String(stage).includes("transparency-disclaimer")) {
        this.generalservice.handleFlowController("receiverContainer");
        // this.disableTheButtonsOfPreviousListElement();
      }
    });
    //   IdentifyOrAnonymousForms
    ul.addEventListener("customGiverEventFromMsgClass", (e: CustomEvent) => {
      const { typeOfEvent, message, componentToLoad } = e.detail;
      if (String(message).includes("giver")) {
        sessionStorage.setItem("route", String(message));
        this.generalservice.receiver = "giver";
        this.route.navigate(["giver"]);
      }
      if (String(componentToLoad).toLowerCase() == "identifyoranonymousforms") {
        this.generalservice.handleFlowController(String(componentToLoad));
      }
      if (String(componentToLoad).toLowerCase() == "supportpageforms") {
        this.generalservice.handleFlowController(String(componentToLoad));
      }
    });

    ul.addEventListener("customGiverResponse", (e: CustomEvent) => {
      const { reply, message } = e.detail;
      // console.log(reply);
      // console.log(message.trim());
      this.insertGiversResponseIntoDom(reply, message);
    });

    ul.addEventListener("customEventFromMessageClass", (e: CustomEvent) => {
      // console.log(e.detail);
      if (String(e.detail).includes("IdentifyOrAnonymousForms")) {
        // console.log("i am here");
        this.changeModalTitle(String(e.detail));
        this.generalservice.handleFlowController("termsAndCondition");
        // this.disableTheButtonsOfPreviousListElement();
      } else if (typeof e.detail == "object") {
        // this.responseFromGiver(e.detail);
      } else if (String(e.detail).includes("bbrw")) {
        const arr = String(e.detail).split(",");
        this.changeModalTitle(String(e.detail));
        this.generalservice.controlFormsToDisplay(arr);
        this.generalservice.handleFlowController("formsContainer");
        // this.generalservice.ctrlDisableTheButtonsOfPreviousListElement("allow");
        // this.disableTheButtonsOfPreviousListElement();
      } else if (String(e.detail) == "bvn") {
        this.changeModalTitle("bvnAndDOB");
        this.generalservice.controlFormsToDisplay(String(e.detail));
        this.generalservice.handleFlowController("formsContainer");
        // this.disableTheButtonsOfPreviousListElement();
      } else if (String(e.detail) == "stop") {
        this.disableTheButtonsOfPreviousListElement();
        // this.generalservice.responseDisplayNotifier("stop");
        sessionStorage.clear();
      } else if (String(e.detail) == "uploadPhotoAndStatement") {
        this.changeModalTitle(String(e.detail));
        this.generalservice.controlFormsToDisplay(String(e.detail));
        this.generalservice.handleFlowController("formsContainer");
        // this.getQuestions();
        // console.log("i got here");
      } else if (String(e.detail) == "licensevalidation") {
        this.changeModalTitle(String(e.detail));
        this.generalservice.controlFormsToDisplay(String(e.detail));
        this.generalservice.handleFlowController("formsContainer");
        this.getQuestions();
      } else if (String(e.detail) == "startTest") {
        this.changeModalTitle(String(e.detail));
        // // this part will be reworked
        // ends here
        this.generalservice.handleFlowController("QuestionsContainer");
        this.getQuestions();
      } else if (String(e.detail) == "skip") {
        // this part will be reworked
        // ends here
        this.changeModalTitle(String(e.detail));
        this.userDidNotProvideDriversLicense();
        this.generalservice.ctrlDisableTheButtonsOfPreviousListElement("allow");
        this.getQuestions();
      }
    });
  }

  // old code from creditclan chatbot
  respondToChangesFromOutside(value: any) {
    // debugger;
    switch (value) {
      case "termsAndConditionAccepted":
        this.displaySubsequentMessages({
          message: `
            I have read and accepted the terms and conditions.
          `,
          direction: "right"
        });
        setTimeout(() => {
          this.displaySubsequentMessages({
            message: `
             Please provide your BVN and date of birth
            `,
            direction: "left",
            button: "Provide bvn"
          });
        }, 500);
        break;
      case "stop":
        this.displaySubsequentMessages({
          message: `
            Ok, Thank you for your time.
          `,
          direction: "left"
        });
        break;
    }
  }

  // covid relief bot replies to givers
  respondToUsers(reply: replyGiversOrReceivers) {
    this.displaySubsequentMessages({
      message: reply.message,
      direction: reply.direction,
      button: reply.button,
      extraInfo: reply.extraInfo
    });
  }

  // A funtion to control  Givers Response to chatbot questions and also respond accordingly;
  // so sometimes there would be a reply.reply and at other times there would not
  // when there is not. The try will run run successfully. Else the catch will run.
  insertGiversResponseIntoDom(
    reply: replyGiversOrReceivers,
    chatbotReply?: replyGiversOrReceivers
  ) {
    try {
      const { message, direction } = reply["reply"];
      // console.log(chatbotReply);
      this.displaySubsequentMessages({
        message: message,
        direction: direction
      });
      this.generalservice.ctrlDisableTheButtonsOfPreviousListElement("allow");
      setTimeout(() => {
        this.displaySubsequentMessages(chatbotReply);
      }, 1000);
    } catch (e) {
      const { message, direction } = reply;
      this.displaySubsequentMessages({
        message: message,
        direction: direction
      });
      this.generalservice.ctrlDisableTheButtonsOfPreviousListElement("allow");
      setTimeout(() => {
        this.displaySubsequentMessages(chatbotReply);
      }, 1000);
    }
  }

  responseFromReceiver(obj: ReceiversResponse) {
    if (typeof obj.messageForUserToDisplayInResponseToPreviousStage) {
      this.displaySubsequentMessages({
        message: obj.messageForUserToDisplayInResponseToPreviousStage.message,
        direction:
          obj.messageForUserToDisplayInResponseToPreviousStage.direction
      });
    }
  }

  // responseFromGiver(obj: GiverResponse, reply?: object) {
  //   if (obj.message.length < 1) {
  //     this.displaySubsequentMessages({
  //       message: obj.text,
  //       direction: "right"
  //     });
  //     if (!reply) {
  //       this.generalservice.nextReplyFromCovidRelief({
  //         message:
  //           "Would you like to stay anonymous or be an identified giver?",
  //         direction: "left",
  //         button: "Identify,Anonymous",
  //         extraInfo: "identify,anonymous"
  //       });
  //     }
  //   } else {
  //     this.changeModalTitle(String(obj.message));
  //     this.generalservice.controlFormsToDisplay(obj.message);
  //     this.generalservice.handleFlowController("formsContainer");
  //   }
  // }
  displaySubsequentMessages(obj: {
    message: string;
    direction: string;
    button?: string;
    extraInfo?: string;
  }) {
    const ul = this.messagePlaceHolder.nativeElement as HTMLUListElement;
    // console.log(message, direction);
    if (!obj.button) {
      const messageToDisplay = new Message(
        `${obj.message ? obj.message : " "}`,
        `${obj.direction ? obj.direction : "left"}`,
        ul
      );
      //  incrementing this is important
      this.count++;
      messageToDisplay.makeAndInsertMessage(this.count);
    } else {
      this.count++;
      const messageToDisplay = new Message(
        `${obj.message ? obj.message : " "}`,
        `${obj.direction ? obj.direction : "left"}`,
        ul,
        obj.button,
        obj.extraInfo
      );
      messageToDisplay.makeAndInsertMessage(this.count);
      // console.log(this.count);
    }
  }

  // changes the title of Modal for the different forms
  changeModalTitle(str: string) {
    this.generalservice.nameOfModal = str;
  }

  handleBVNAndDOBError(err: any) {
    if (err.status == 500) {
      this.displaySubsequentMessages({
        message: Message.displayMsgWhenThereIsServerError(),
        direction: "left"
      });
    }
  }

  checkForRefNoAndDisplayAppropriateMsg(ref?: string) {
    // debugger;
    let refToSend = { ref_no: ref };
    this.chatservice.fetchRefNumber(refToSend).subscribe(
      (val: ValidateRefResponse) => {
        console.log(val);
        let msg: { message: string; direction: string; button?: string };
        msg = this.generalservice.handleValidRef(val);
        try {
          this.displaySubsequentMessages(msg);
        } catch (e) {
          return;
        }
        console.log(msg.message);
      },
      err =>
        this.displaySubsequentMessages(
          this.generalservice.handleRefCheckingError(err)
        )
    );
  }

  requestRef(ref: string) {
    setTimeout(() => {
      if (!ref) {
        this.displaySubsequentMessages({
          message: "Is this your first time giving here for COVID Relief",
          direction: "left",
          button: "Yes, No",
          extraInfo: "startGiving, notInterested"
        });
        this.actionDispatched.emit("refChecking");
      } else {
        this.checkForRefNoAndDisplayAppropriateMsg(ref);
      }
    }, 300);
  }

  // disable buttons in previous elements
  disableTheButtonsOfPreviousListElement() {
    //  document.querySelector("ul > li:last-child");
    // debugger;
    try {
      const buttonContainer = document.querySelector(".button-container");
      if (buttonContainer.classList.contains("right")) {
        const buttons: NodeListOf<
          HTMLButtonElement
        > = buttonContainer.previousElementSibling.querySelectorAll(
          ".dynamicButton"
        );
        buttons.forEach(button => {
          button.classList.add("disabled");
          button.disabled = true;
        });
      }
    } catch (e) {
      console.log(e);
    }
    try {
      let nl: NodeList = document.querySelectorAll(".button-container");
      const buttons = (nl[nl.length - 1] as HTMLButtonElement).querySelectorAll(
        ".dynamicButton"
      );
      if (buttons.length > 0) {
        let button: HTMLButtonElement;
        for (let i = 0; i < buttons.length; i++) {
          button = buttons[i] as HTMLButtonElement;
          if (
            buttons[i].classList.contains("dynamicButton") &&
            !button.disabled
          ) {
            // remember to add a disabled class here, after you have disabled it
            // so that it can appear disabled
            button.classList.add("disabled");
            button.disabled = true;
            // removes the button from the dom;
            button.style.pointerEvents = "none";
          } else {
            continue;
          }
        }
      }
    } catch (e) {}
  }

  userDidNotProvideDriversLicense() {
    this.displaySubsequentMessages({
      message: "No, i do not have a drivers license.",
      direction: "right"
    });

    setTimeout(() => {
      this.displaySubsequentMessages({
        message: "Ok, when you are ready, Let us now play a 120 secs game",
        direction: "left",
        button: "Play, Pause"
      });
    }, 1000);
  }

  specialCaseButtons(buttons: Array<HTMLButtonElement>) {
    buttons.forEach((button: HTMLButtonElement) => {
      if (
        button.textContent.includes("Address") ||
        button.textContent.includes("Work") ||
        button.textContent.includes("Ok begin")
      ) {
        button.classList.add("disabled");
        button.disabled = true;
        button.style.pointerEvents = "none";
      }
    });
  }

  getQuestions() {
    const questions = sessionStorage.getItem("questions");
    // console.log(questions);
    if (!questions) {
      let ref_no = sessionStorage.getItem("ref_no");
      this.chatservice.getCredibiltyQuestions(ref_no).subscribe(val => {
        sessionStorage.setItem("questions", JSON.stringify(val.text));
      });
    }
  }

  welcomeMsgCtrl(str: string) {
    this.generalservice.typeOfPerson = "";
    let regex = /receiver/;
    if (regex.test(str)) {
      this.receiverIsPresent = true;
      this.generalservice.typeOfPerson = str;
    } else {
      this.generalservice.typeOfPerson = str;
      this.receiverIsPresent = false;
    }
  }

  generateWelcomeMsgForReceiverOrGiver(
    ul: HTMLUListElement,
    giverOrReceiver?: string
  ) {
    // console.log(this.receiverIsPresent);
    setTimeout(() => {
      if (this.generalservice.receiver == "receiver") {
        const msgs = Message.welcomeMsgForReceiver;
        let messageToDisplay: Message;
        msgs.forEach((msg, index) => {
          if (index == 2) {
            this.count = index;
            messageToDisplay = new Message(
              `${msg}`,
              `left`,
              ul,
              "Yes,No i am giving",
              "receive,give"
            );
            messageToDisplay.makeAndInsertMessage(this.count);
            return;
          }
          messageToDisplay = new Message(`${msg}`, `left`, ul);
          messageToDisplay.makeAndInsertMessage(index);
        });
      } else {
        // "identify,stayanonymous"
        const msgs = Message.welcomeMessagesForGiver;
        let messageToDisplay: Message;
        this.count = 0;
        msgs.forEach((msg, index) => {
          if (index == 1) {
            this.count = index;
            messageToDisplay = new Message(
              `${msg}`,
              `left`,
              ul,
              "Yes,No",
              "firstTimeGiver,notFirstTimeGiver"
            );
            messageToDisplay.makeAndInsertMessage(this.count);
            return;
          }
          messageToDisplay = new Message(`${msg}`, `left`, ul);
          messageToDisplay.makeAndInsertMessage(index);
        });
      }
    }, 1000);
  }

  generateSuccessfulSubmissionOfRequestMsg(ul: HTMLUListElement) {
    const msgs = Message.successfulRequestsMade;
    let messageToDisplay: Message;
    msgs.forEach((msg, index) => {
      messageToDisplay = new Message(`${msg}`, `left`, ul);
      messageToDisplay.makeAndInsertMessage(2);
    });
  }

  generateFailedRequestMsg(ul: HTMLUListElement) {
    const msgs = Message.failedRequests;
    let messageToDisplay: Message;
    msgs.forEach((msg, index) => {
      messageToDisplay = new Message(`${msg}`, `left`, ul);
      messageToDisplay.makeAndInsertMessage(2);
    });
  }

  ngOnDestroy() {
    // let remove: Subscription
    // this.observableToTrash.displayResponse.unsubscribe
    if (
      this.observableToTrash.preventDisabling ||
      this.observableToTrash.destroyNextReply
    ) {
      // this.observableToTrash.apiCall.unsubscribe();
      this.observableToTrash.preventDisabling.unsubscribe();
      this.observableToTrash.destroyNextReply.unsubscribe();
    }
  }
}
