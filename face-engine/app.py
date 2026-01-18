# Face Engine - Python Flask Microservice
# 
# Lightweight face verification service using dlib/face_recognition
# Handles face encoding and comparison for AttendSmart
#
# Endpoints:
#   POST /verify - Compare two face images
#   POST /encode - Get 128D face encoding from image
#   GET /health  - Health check
#
# @version 1.0.0

from flask import Flask, request, jsonify
import face_recognition
import numpy as np
import base64
import io
import os
import logging
from PIL import Image
from functools import wraps

# ============================================
# CONFIGURATION
# ============================================

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('face-engine')

# Environment configuration
CONFIDENCE_THRESHOLD = float(os.getenv('FACE_CONFIDENCE_THRESHOLD', '0.6'))
MAX_FACES_PER_IMAGE = int(os.getenv('MAX_FACES_PER_IMAGE', '1'))

# ============================================
# HELPER FUNCTIONS
# ============================================

def decode_base64_image(base64_string):
    """
    Decode a base64 image string to numpy array for face_recognition.
    Supports data URLs (data:image/jpeg;base64,...)
    """
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_string)
        
        # Open with PIL and convert to RGB
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed (handle RGBA, grayscale, etc.)
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Convert to numpy array for face_recognition
        return np.array(pil_image)
    
    except Exception as e:
        logger.error(f"Failed to decode image: {str(e)}")
        raise ValueError(f"Invalid image data: {str(e)}")


def get_face_encoding(image_array):
    """
    Extract 128D face encoding from image.
    Returns encoding array or None if no face found.
    """
    try:
        # Detect face locations
        face_locations = face_recognition.face_locations(image_array, model='hog')
        
        if len(face_locations) == 0:
            logger.warning("No face detected in image")
            return None, "No face detected"
        
        if len(face_locations) > MAX_FACES_PER_IMAGE:
            logger.warning(f"Multiple faces detected: {len(face_locations)}")
            return None, "Multiple faces detected - use single face image"
        
        # Get encoding for the first face
        encodings = face_recognition.face_encodings(image_array, face_locations)
        
        if len(encodings) == 0:
            return None, "Could not encode face"
        
        return encodings[0], None
    
    except Exception as e:
        logger.error(f"Face encoding error: {str(e)}")
        return None, str(e)


def compare_faces(source_encoding, target_encoding, tolerance=0.6):
    """
    Compare two face encodings.
    Returns match result and confidence score.
    
    Lower distance = higher confidence match.
    Typical threshold: 0.6 (distance < 0.6 is a match)
    """
    try:
        # Calculate Euclidean distance between encodings
        distance = face_recognition.face_distance([source_encoding], target_encoding)[0]
        
        # Convert distance to confidence (0-1 scale, higher is better)
        # distance of 0 = confidence of 1, distance of 1 = confidence of 0
        confidence = max(0, 1 - distance)
        
        # Check if match
        is_match = distance <= tolerance
        
        return {
            'match': bool(is_match),
            'confidence': float(confidence),
            'distance': float(distance),
            'threshold': tolerance
        }
    
    except Exception as e:
        logger.error(f"Face comparison error: {str(e)}")
        raise


def require_json(f):
    """Decorator to ensure request has JSON content type."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
        return f(*args, **kwargs)
    return decorated


# ============================================
# API ENDPOINTS
# ============================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Docker/Kubernetes."""
    return jsonify({
        'status': 'healthy',
        'service': 'face-engine',
        'version': '1.0.0',
        'confidence_threshold': CONFIDENCE_THRESHOLD
    })


@app.route('/encode', methods=['POST'])
@require_json
def encode_face():
    """
    Extract 128D face encoding from an image.
    
    Request body:
        image: base64 encoded image string
    
    Response:
        encoding: array of 128 floats
        face_detected: boolean
    """
    try:
        data = request.get_json()
        
        if 'image' not in data:
            return jsonify({'error': 'Missing required field: image'}), 400
        
        # Decode image
        image_array = decode_base64_image(data['image'])
        
        # Get face encoding
        encoding, error = get_face_encoding(image_array)
        
        if encoding is None:
            return jsonify({
                'success': False,
                'face_detected': False,
                'error': error or 'No face detected'
            }), 200  # Return 200 with error in body for easier handling
        
        # Return encoding as list
        return jsonify({
            'success': True,
            'face_detected': True,
            'encoding': encoding.tolist(),
            'dimensions': len(encoding)
        })
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception("Encode endpoint error")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/verify', methods=['POST'])
@require_json
def verify_faces():
    """
    Compare two face images for identity verification.
    
    Request body options:
        Option 1 (image comparison):
            source_image: base64 encoded source face image
            target_image: base64 encoded target face image
        
        Option 2 (encoding comparison):
            source_encoding: 128D encoding array
            target_image: base64 encoded target face image
    
    Response:
        match: boolean
        confidence: float (0-1)
        distance: float (lower is better)
    """
    try:
        data = request.get_json()
        
        # Get source encoding (from image or pre-computed)
        if 'source_encoding' in data:
            # Use pre-computed encoding
            source_encoding = np.array(data['source_encoding'])
            
            if len(source_encoding) != 128:
                return jsonify({'error': 'source_encoding must be 128 dimensions'}), 400
        
        elif 'source_image' in data:
            # Extract encoding from source image
            source_array = decode_base64_image(data['source_image'])
            source_encoding, error = get_face_encoding(source_array)
            
            if source_encoding is None:
                return jsonify({
                    'match': False,
                    'confidence': 0.0,
                    'error': f'Source image error: {error}'
                })
        
        else:
            return jsonify({'error': 'Missing source_image or source_encoding'}), 400
        
        # Get target encoding from image
        if 'target_image' not in data:
            return jsonify({'error': 'Missing required field: target_image'}), 400
        
        target_array = decode_base64_image(data['target_image'])
        target_encoding, error = get_face_encoding(target_array)
        
        if target_encoding is None:
            return jsonify({
                'match': False,
                'confidence': 0.0,
                'error': f'Target image error: {error}'
            })
        
        # Compare faces
        tolerance = data.get('tolerance', CONFIDENCE_THRESHOLD)
        result = compare_faces(source_encoding, target_encoding, tolerance)
        
        logger.info(f"Face verification: match={result['match']}, confidence={result['confidence']:.3f}")
        
        return jsonify(result)
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception("Verify endpoint error")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/batch-encode', methods=['POST'])
@require_json
def batch_encode():
    """
    Encode multiple images and return averaged encoding.
    Used for enrollment with multiple photos.
    
    Request body:
        images: array of base64 encoded images
    
    Response:
        encoding: averaged 128D encoding
        successful_count: number of images successfully encoded
    """
    try:
        data = request.get_json()
        
        if 'images' not in data or not isinstance(data['images'], list):
            return jsonify({'error': 'Missing or invalid images array'}), 400
        
        if len(data['images']) < 1:
            return jsonify({'error': 'At least 1 image required'}), 400
        
        if len(data['images']) > 10:
            return jsonify({'error': 'Maximum 10 images allowed'}), 400
        
        encodings = []
        errors = []
        
        for i, image_data in enumerate(data['images']):
            try:
                image_array = decode_base64_image(image_data)
                encoding, error = get_face_encoding(image_array)
                
                if encoding is not None:
                    encodings.append(encoding)
                else:
                    errors.append(f"Image {i+1}: {error}")
            except Exception as e:
                errors.append(f"Image {i+1}: {str(e)}")
        
        if len(encodings) == 0:
            return jsonify({
                'success': False,
                'error': 'No valid faces found in any image',
                'details': errors
            }), 200
        
        # Average all encodings for more robust representation
        averaged_encoding = np.mean(encodings, axis=0)
        
        return jsonify({
            'success': True,
            'encoding': averaged_encoding.tolist(),
            'dimensions': len(averaged_encoding),
            'successful_count': len(encodings),
            'total_count': len(data['images']),
            'errors': errors if errors else None
        })
    
    except Exception as e:
        logger.exception("Batch encode error")
        return jsonify({'error': 'Internal server error'}), 500


# ============================================
# ERROR HANDLERS
# ============================================

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large. Maximum size is 16MB.'}), 413


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


# ============================================
# MAIN
# ============================================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting Face Engine on port {port}")
    logger.info(f"Confidence threshold: {CONFIDENCE_THRESHOLD}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
