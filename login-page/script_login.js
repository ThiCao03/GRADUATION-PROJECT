const container = document.getElementById("container");
const registerBtn = document.getElementById("register");
const loginBtn = document.getElementById("login");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const modal = document.getElementById("resetPasswordModal");
const resetEmailInput = document.getElementById("resetEmail");
const cancelResetBtn = document.getElementById("cancelResetBtn");
const sendResetBtn = document.getElementById("sendResetBtn");
const resetMessage = document.getElementById("resetMessage");

// Tạo modal thông báo yêu cầu xác minh email
function createVerificationModal() {
  const verificationModal = document.createElement('div');
  verificationModal.className = 'modal';
  verificationModal.id = 'verificationModal';
  verificationModal.innerHTML = `
    <div class="modal-content">
      <h2>Xác minh tài khoản</h2>
      <p>Một email xác minh đã được gửi đến địa chỉ email của bạn. Vui lòng kiểm tra hộp thư và xác nhận để kích hoạt tài khoản.</p>
      <div class="modal-buttons">
        <button class="reset-btn" id="closeVerificationBtn" style="width: 100%">Đã hiểu</button>
      </div>
    </div>
  `;
  document.body.appendChild(verificationModal);

  document.getElementById('closeVerificationBtn').addEventListener('click', function() {
    document.getElementById('verificationModal').style.display = 'none';
  });

  return verificationModal;
}

// Đảm bảo Firebase đã sẵn sàng trước khi thiết lập các sự kiện
function initApp() {
  // Tạo modal xác minh email nếu chưa tồn tại
  let verificationModal = document.getElementById('verificationModal');
  if (!verificationModal) {
    verificationModal = createVerificationModal();
  }

  registerBtn.addEventListener("click", () => {
    container.classList.add("active");
  });

  loginBtn.addEventListener("click", () => {
    container.classList.remove("active");
  });

  // Firebase Login
  document.querySelector('.sign-in button').addEventListener('click', function(event) {
    event.preventDefault();

    // Lấy giá trị email và mật khẩu từ form đăng nhập
    const email = document.querySelector('.sign-in input[type="email"]').value;
    const password = document.querySelector('.sign-in input[type="password"]').value;
    
    // Kiểm tra xem email và mật khẩu có được nhập không
    if (!email || !password) {
      alert("Vui lòng nhập email và mật khẩu");
      return;
    }

    // Đăng nhập với Firebase
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Đăng nhập thành công
        const user = userCredential.user;
        
        // Kiểm tra xem email đã được xác minh chưa
        if (user.emailVerified) {
          alert("Đăng nhập thành công!");
          // Lưu thông tin đăng nhập vào localStorage để duy trì trạng thái đăng nhập
          localStorage.setItem('user', JSON.stringify({
            email: user.email,
            uid: user.uid
          }));
          // Chuyển hướng đến trang dashboard
          window.location.href = '../dashboard-page/dashboard.html';
        } else {
          // Yêu cầu xác minh email trước khi đăng nhập
          alert("Vui lòng xác minh email của bạn trước khi đăng nhập. Kiểm tra hộp thư của bạn để biết liên kết xác minh.");
          
          // Gửi lại email xác minh nếu cần
          sendEmailVerification(user)
            .then(() => {
              // Email xác minh đã được gửi
              verificationModal.style.display = "flex";
            })
            .catch((error) => {
              console.error("Lỗi khi gửi email xác minh:", error);
            });
          
          // Đăng xuất người dùng vì họ chưa xác minh email
          auth.signOut();
        }
      })
      .catch((error) => {
        // Xử lý lỗi
        const errorCode = error.code;
        let errorMessage;
        
        switch(errorCode) {
          case 'auth/invalid-email':
            errorMessage = "Email không hợp lệ.";
            break;
          case 'auth/invalid-credential':
            errorMessage = "Email hoặc mật khẩu không đúng.";
            break;
          case 'auth/user-not-found':
            errorMessage = "Không tìm thấy tài khoản với email này.";
            break;
          case 'auth/wrong-password':
            errorMessage = "Mật khẩu không đúng.";
            break;
          default:
            errorMessage = `Lỗi đăng nhập: ${error.message}`;
        }
        
        alert(errorMessage);
      });
  });

  // Firebase Registration
  document.querySelector('.sign-up button').addEventListener('click', function(event) {
    event.preventDefault();
    
    // Lấy giá trị từ form đăng ký
    const name = document.querySelector('.sign-up input[type="text"]').value;
    const email = document.querySelector('.sign-up input[type="email"]').value;
    const password = document.querySelector('.sign-up input[type="password"]').value;
    
    // Kiểm tra xem các trường có được nhập không
    if (!name || !email || !password) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    
    // Kiểm tra độ mạnh của mật khẩu
    if (password.length < 6) {
      alert("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    // Đăng ký tài khoản với Firebase
    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Đăng ký thành công
        const user = userCredential.user;
        
        // Gửi email xác minh
        return sendEmailVerification(user)
          .then(() => {
            // Email xác minh đã được gửi
            verificationModal.style.display = "flex";
            
            // Chuyển sang giao diện đăng nhập
            container.classList.remove("active");
          });
      })
      .catch((error) => {
        // Xử lý lỗi
        const errorCode = error.code;
        let errorMessage;
        
        switch(errorCode) {
          case 'auth/email-already-in-use':
            errorMessage = "Email này đã được sử dụng.";
            break;
          case 'auth/invalid-email':
            errorMessage = "Email không hợp lệ.";
            break;
          case 'auth/weak-password':
            errorMessage = "Mật khẩu không đủ mạnh.";
            break;
          default:
            errorMessage = `Lỗi đăng ký: ${error.message}`;
        }
        
        alert(errorMessage);
      });
  });

  // Chức năng quên mật khẩu - Hiển thị modal
  forgotPasswordLink.addEventListener('click', function(event) {
    event.preventDefault();
    modal.style.display = "flex";
    
    // Điền sẵn email từ form đăng nhập nếu có
    const loginEmail = document.querySelector('.sign-in input[type="email"]').value;
    if (loginEmail) {
      resetEmailInput.value = loginEmail;
    }
  });

  // Đóng modal khi nhấn nút hủy
  cancelResetBtn.addEventListener('click', function() {
    modal.style.display = "none";
    resetEmailInput.value = '';
    resetMessage.style.display = 'none';
  });

  // Đóng modal khi nhấn ra ngoài
  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = "none";
      resetEmailInput.value = '';
      resetMessage.style.display = 'none';
    }
    if (event.target === verificationModal) {
      verificationModal.style.display = "none";
    }
  });

  // Xử lý gửi email đặt lại mật khẩu
  sendResetBtn.addEventListener('click', function() {
    const email = resetEmailInput.value.trim();
    
    if (!email) {
      resetMessage.textContent = "Vui lòng nhập địa chỉ email.";
      resetMessage.style.color = "#e74c3c";
      resetMessage.style.display = 'block';
      return;
    }
    
    // Gửi email đặt lại mật khẩu bằng Firebase
    sendPasswordResetEmail(auth, email)
      .then(() => {
        resetMessage.textContent = "Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.";
        resetMessage.style.color = "#2ecc71";
        resetMessage.style.display = 'block';
        
        // Đóng modal sau 5 giây
        setTimeout(() => {
          modal.style.display = "none";
          resetEmailInput.value = '';
          resetMessage.style.display = 'none';
        }, 5000);
      })
      .catch((error) => {
        const errorCode = error.code;
        let errorMessage;
        
        switch(errorCode) {
          case 'auth/invalid-email':
            errorMessage = "Email không hợp lệ.";
            break;
          case 'auth/user-not-found':
            errorMessage = "Không tìm thấy tài khoản với email này.";
            break;
          default:
            errorMessage = `Lỗi: ${error.message}`;
        }
        
        resetMessage.textContent = errorMessage;
        resetMessage.style.color = "#e74c3c";
        resetMessage.style.display = 'block';
      });
  });
}

// Khởi tạo ứng dụng khi Firebase đã sẵn sàng
if (window.firebaseReady) {
  initApp();
} else {
  document.addEventListener('firebaseReady', initApp);
}
