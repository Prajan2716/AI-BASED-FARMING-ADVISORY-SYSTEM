document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  const username = this.username.value.trim();
  const password = this.password.value;
  const errorMsg = document.getElementById('error-msg');
  errorMsg.style.display = 'none';
  errorMsg.textContent = '';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Successful login - redirect to homepage
      window.location.href = 'index.html';
    } else {
      // Display backend error message
      errorMsg.textContent = data.message || 'Invalid username or password.';
      errorMsg.style.display = 'block';
    }
  } catch (error) {
    // Network or other errors
    errorMsg.textContent = 'Network error. Please try again later.';
    errorMsg.style.display = 'block';
    console.error('Login request error:', error);
  }
});
