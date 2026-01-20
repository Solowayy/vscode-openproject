(function () {
  const vscode = acquireVsCodeApi();

  // DOM Elements
  const viewContainer = document.getElementById("view-container");
  const editContainer = document.getElementById("edit-container");

  // Buttons
  const btnEdit = document.getElementById("btn-edit");
  const btnCancel = document.getElementById("btn-cancel");
  const btnSave = document.getElementById("btn-save");

  // Inputs
  const inputSubject = document.getElementById("input-subject");
  const inputDescription = document.getElementById("input-description");
  const selectStatus = document.getElementById("select-status");
  const selectType = document.getElementById("select-type");
  const selectPriority = document.getElementById("select-priority");

  // Event Listeners
  if (btnEdit) {
    btnEdit.addEventListener("click", () => {
      toggleMode("edit");
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      toggleMode("view");
    });
  }

  if (btnSave) {
    btnSave.addEventListener("click", () => {
      saveChanges();
    });
  }

  function toggleMode(mode) {
    if (mode === "edit") {
      viewContainer.style.display = "none";
      editContainer.style.display = "block";
    } else {
      viewContainer.style.display = "block";
      editContainer.style.display = "none";
    }
  }

  function saveChanges() {
    const data = {
      subject: inputSubject ? inputSubject.value : "",
      description: inputDescription ? inputDescription.value : "",
      statusId: selectStatus ? selectStatus.value : "",
      typeId: selectType ? selectType.value : "",
      priorityId: selectPriority ? selectPriority.value : "",
    };

    vscode.postMessage({
      command: "save",
      data: data,
    });
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "updateSuccess":
        toggleMode("view");
        break;
      case "updateError":
        alert("Failed to update work package. Please try again.");
        break;
    }
  });
})();
