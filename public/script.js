
document.addEventListener('DOMContentLoaded', function() {

    const adminLoginLink = document.querySelector('.admin-login');
    
    if (adminLoginLink) {
        adminLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'admin.html';
        });
    }
    
    const createMobileMenu = () => {
        const nav = document.querySelector('nav');
        const menuToggle = document.createElement('div');
        menuToggle.className = 'menu-toggle';
        menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        nav.prepend(menuToggle);
        
        menuToggle.addEventListener('click', function() {
            const mainMenu = document.querySelector('.main-menu');
            mainMenu.classList.toggle('active');
        });
    };
    if (window.innerWidth < 768) {
        createMobileMenu();
    }
    window.addEventListener('resize', function() {
        if (window.innerWidth < 768 && !document.querySelector('.menu-toggle')) {
            createMobileMenu();
        }
    });
    
    const featureCards = document.querySelectorAll('.feature-card');
    if (featureCards.length > 0) {
        window.addEventListener('scroll', function() {
            featureCards.forEach(card => {
                const cardPosition = card.getBoundingClientRect().top;
                const screenPosition = window.innerHeight / 1.3;
                
                if (cardPosition < screenPosition) {
                    card.classList.add('animate');
                }
            });
        });
    }
    
    const enquiryForm = document.querySelector('.enquiry-form');
    if (enquiryForm) {
        enquiryForm.addEventListener('submit', function(e) {
            const nameInput = document.querySelector('input[name="name"]');
            const emailInput = document.querySelector('input[name="email"]');
            
            if (!nameInput.value || !emailInput.value) {
                e.preventDefault();
                alert('Please fill all required fields');
            }
        });
    }
});