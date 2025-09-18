const form = document.getElementById("feedbackForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        name: formData.get("name"),
        email: formData.get("email"),
        message: formData.get("message")
      };
      try {
        const response = await fetch("/api/submit-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
          alert("Thank you for your feedback!");
          form.reset();
        } else {
          alert("Failed to submit feedback. Please try again.");
        }
      } catch {
        alert("Error submitting feedback. Please try again.");
      }
    });