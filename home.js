document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      // Redirect to login page after successful logout
      window.location.href = 'login.html';
    } else {
      alert('Logout failed');
    }
  } catch (err) {
    alert('Logout error');
  }
});
