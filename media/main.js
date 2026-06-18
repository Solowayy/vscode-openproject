(function () {
  const vscode = acquireVsCodeApi();

  // DOM Elements
  const viewContainer = document.getElementById("view-container");
  const editContainer = document.getElementById("edit-container");

  // Buttons
  const btnRefresh = document.getElementById("btn-refresh");
  const btnEdit = document.getElementById("btn-edit");
  const btnCancel = document.getElementById("btn-cancel");
  const btnSave = document.getElementById("btn-save");

  // Inputs
  const inputSubject = document.getElementById("input-subject");
  const inputDescription = document.getElementById("input-description");
  const selectStatus = document.getElementById("select-status");
  const selectType = document.getElementById("select-type");
  const selectPriority = document.getElementById("select-priority");
  const inputDueDate = document.getElementById("input-dueDate");
  const inputStartDate = document.getElementById("input-startDate");

  // Event Listeners
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      vscode.postMessage({ command: "refresh" });
    });
  }

  if (btnEdit) {
    btnEdit.addEventListener("click", () => {
      toggleMode("edit");
      syncDates();
    });
  }

  function syncDates() {
    if (!inputStartDate || !inputDueDate || !selectType) return;
    
    // Check if the selected text is "Milestone"
    const selectedOption = selectType.options[selectType.selectedIndex];
    const isMilestone = selectedOption && selectedOption.text.toLowerCase() === "milestone";
    
    if (isMilestone) {
        // Enforce same dates for milestones
        if (inputDueDate.value && !inputStartDate.value) {
            inputStartDate.value = inputDueDate.value;
        } else if (inputStartDate.value && !inputDueDate.value) {
            inputDueDate.value = inputStartDate.value;
        }
        
        inputStartDate.min = inputDueDate.value;
        inputStartDate.max = inputDueDate.value;
        inputDueDate.min = inputStartDate.value;
        inputDueDate.max = inputStartDate.value;
    } else {
        // Enforce start <= due for normal tasks
        inputDueDate.min = inputStartDate.value || "";
        inputStartDate.max = inputDueDate.value || "";
    }
  }

  if (selectType) {
      selectType.addEventListener("change", () => {
          // If changed to milestone, sync them
          const isMilestone = selectType.options[selectType.selectedIndex]?.text.toLowerCase() === "milestone";
          if (isMilestone && inputDueDate.value) {
              inputStartDate.value = inputDueDate.value;
          }
          syncDates();
      });
  }
  
  if (inputStartDate) {
      inputStartDate.addEventListener("change", () => {
          const isMilestone = selectType.options[selectType.selectedIndex]?.text.toLowerCase() === "milestone";
          if (isMilestone) inputDueDate.value = inputStartDate.value;
          syncDates();
      });
  }
  
  if (inputDueDate) {
      inputDueDate.addEventListener("change", () => {
          const isMilestone = selectType.options[selectType.selectedIndex]?.text.toLowerCase() === "milestone";
          if (isMilestone) inputStartDate.value = inputDueDate.value;
          syncDates();
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

  function parseEuDate(v) {
    if (!v) return null;
    v = v.trim();
    if (v.toLowerCase() === 't' || v.toLowerCase() === 'today') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    const euMatch = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (euMatch) {
        const dd = euMatch[1].padStart(2, '0');
        const mm = euMatch[2].padStart(2, '0');
        const yyyy = euMatch[3];
        return `${yyyy}-${mm}-${dd}`;
    }
    const isoMatch = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        const yyyy = isoMatch[1];
        const mm = isoMatch[2].padStart(2, '0');
        const dd = isoMatch[3].padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return v; // fallback
  }

  function saveChanges() {
    const data = {
      subject: inputSubject ? inputSubject.value : "",
      description: inputDescription ? inputDescription.value : "",
    };

    if (
      selectStatus &&
      selectStatus.value &&
      selectStatus.value.trim() !== ""
    ) {
      data.statusId = selectStatus.value;
    }
    if (selectType && selectType.value && selectType.value.trim() !== "") {
      data.typeId = selectType.value;
    }
    if (
      selectPriority &&
      selectPriority.value &&
      selectPriority.value.trim() !== ""
    ) {
      data.priorityId = selectPriority.value;
    }
    if (inputDueDate) {
      data.dueDate = parseEuDate(inputDueDate.value) || null;
    }
    if (inputStartDate) {
      data.startDate = parseEuDate(inputStartDate.value) || null;
    }

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
