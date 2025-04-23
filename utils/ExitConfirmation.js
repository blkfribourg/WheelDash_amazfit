import { createModal, MODAL_CONFIRM } from "@zos/interaction";

export default class ExitConfirmation {
  constructor(callback) {
    this.dialog = createModal({
      content: "Exit the app?",
      autoHide: false,
      onClick: (keyObj) => {
        const { type } = keyObj;
        if (type === MODAL_CONFIRM) {
          console.log("confirm");
          callback();
        } else {
          this.dialog.show(false);
        }
      },
    });
  }
  showExitConfirmation() {
    this.dialog.show(true);
  }
}
