document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('section');
    
    // Fungsi untuk mengatur scroll ke section saat tautan navigasi diklik
    document.querySelectorAll('nav ul li a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();

            const targetId = this.getAttribute('href').substring(1); // Ambil ID tanpa #
            const targetSection = document.getElementById(targetId);

            // Animasi scroll
            window.scrollTo({
                top: targetSection.offsetTop - 100, // Sesuaikan dengan offset header
                behavior: 'smooth'
            });
        });
    });

    // Fungsi untuk menambahkan kelas active pada section saat scrolldown
    window.addEventListener('scroll', () => {
        sections.forEach(section => {
            const top = section.getBoundingClientRect().top;
            if (top >= 0 && top <= window.innerHeight) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
    });
});
