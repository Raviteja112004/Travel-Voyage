// Function to update booking summary
function updateBookingSummary() {
    const numberOfPeople = parseInt(document.getElementById('numberOfPeople').value) || 0;
    const packagePrice = parseFloat(document.getElementById('packagePrice').value) || 0;
    const selectedHotel = document.getElementById('hotelSelect');
    
    // Calculate package subtotal
    const packageSubtotal = packagePrice * numberOfPeople;
    
    // Calculate hotel subtotal
    let hotelPrice = 0;
    let hotelNights = 6; // Get this from your package duration
    let hotelSubtotal = 0;
    let hotelDisplay = 'Not selected';
    
    if (selectedHotel && selectedHotel.value !== '') {
        hotelPrice = parseFloat(selectedHotel.options[selectedHotel.selectedIndex].getAttribute('data-price')) || 0;
        hotelSubtotal = hotelPrice * hotelNights;
        hotelDisplay = `${selectedHotel.options[selectedHotel.selectedIndex].text} (₹${hotelPrice}/night × ${hotelNights} nights)`;
    }

    // Calculate GST (18%)
    const subtotalBeforeGST = packageSubtotal + hotelSubtotal;
    const gst = subtotalBeforeGST * 0.18;
    const totalAmount = subtotalBeforeGST + gst;

    // Update the summary display
    document.getElementById('packageCost').textContent = `₹${packagePrice.toFixed(2)} × ${numberOfPeople}`;
    document.getElementById('packageSubtotal').textContent = `₹${packageSubtotal.toFixed(2)}`;
    document.getElementById('hotelDetails').textContent = hotelDisplay;
    document.getElementById('hotelSubtotal').textContent = `₹${hotelSubtotal.toFixed(2)}`;
    document.getElementById('gstAmount').textContent = `₹${gst.toFixed(2)}`;
    document.getElementById('totalAmount').textContent = `₹${totalAmount.toFixed(2)}`;

    // Update hidden fields for form submission
    document.getElementById('totalAmountInput').value = totalAmount.toFixed(2);
    document.getElementById('hotelSubtotalInput').value = hotelSubtotal.toFixed(2);
    document.getElementById('packageSubtotalInput').value = packageSubtotal.toFixed(2);
    document.getElementById('gstInput').value = gst.toFixed(2);
}

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    const hotelSelect = document.getElementById('hotelSelect');
    const numberOfPeople = document.getElementById('numberOfPeople');

    if (hotelSelect) {
        hotelSelect.addEventListener('change', updateBookingSummary);
    }
    if (numberOfPeople) {
        numberOfPeople.addEventListener('change', updateBookingSummary);
    }

    // Initial calculation
    updateBookingSummary();
}); 