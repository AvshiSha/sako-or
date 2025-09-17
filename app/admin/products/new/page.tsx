'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { productService, categoryService, colorVariantService, Category, storage, Product } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import SuccessMessage from '@/app/components/SuccessMessage'
import GoogleDrivePicker from '@/app/components/GoogleDrivePicker'
import Image from 'next/image'

interface ImageFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  isPrimary?: boolean;
}

interface VideoFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

interface ColorVariantData {
  id: string;
  colorName: string;
  colorSlug: string;
  colorHex: string;
  price?: number;
  salePrice?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  stock: number;
  isActive: boolean;
  images: ImageFile[];
  video: VideoFile | null;
  sizes: string[];
  stockBySize: Record<string, number>;
  metaTitle?: string;
  metaDescription?: string;
}

interface ProductFormData {
  brand: string;
  category: string; // Level 1 category ID
  subcategory: string; // Level 2 category ID
  subsubcategory: string; // Level 3 category ID
  colors: string[];
  colorVariants: ColorVariantData[];
  descriptionEn: string;
  descriptionHe: string;
  featured: boolean;
  nameEn: string;
  nameHe: string;
  new: boolean;
  price: number;
  saleEndDate: string;
  salePrice: number;
  saleStartDate: string;
  baseSku: string;
  currency: string;
  
  // Material & Care fields
  upperMaterialEn: string;
  upperMaterialHe: string;
  materialInnerSoleEn: string;
  materialInnerSoleHe: string;
  liningEn: string;
  liningHe: string;
  soleEn: string;
  soleHe: string;
  heelHeightEn: string;
  heelHeightHe: string;
  
  // Shipping & Returns field
  shippingReturnsEn: string;
  shippingReturnsHe: string;
}

interface FormErrors {
  nameEn?: string;
  nameHe?: string;
  descriptionEn?: string;
  descriptionHe?: string;
  price?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  subsubcategory?: string;
  colors?: string;
  baseSku?: string;
}


const commonSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL','34','35','36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
const commonColors = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Orange', 'light Brown', 'Dark Brown', 'Gray', 'Navy', 'Beige', 'Gold', 'Silver', 'Off White', 'Light Blue', 'Dark Blue', 'Bordeaux', 'Black nail polish', 'Olive', 'Multicolor', 'Black & White', 'Transparent'];

// Color hex mapping
const colorHexMap: Record<string, string> = {
  'Black': '#000000',
  'White': '#FFFFFF',
  'Red': '#FF0000',
  'Blue': '#0000FF',
  'Green': '#008000',
  'Yellow': '#FFFF00',
  'Purple': '#800080',
  'Pink': '#FFC0CB',
  'Orange': '#FFA500',
  'light Brown': '#b5651d',
  'Dark Brown': '#654321',
  'Gray': '#808080',
  'Navy': '#000080',
  'Beige': '#F5F5DC',
  'Gold': '#FFD700',
  'Silver': '#C0C0C0',
  'Off White': '#f5f5f5',
  'Light Blue': '#ADD8E6',
  'Dark Blue': '#000080',
  'Bordeaux': '#800020',
  'Black nail polish': '#000000',
  'Olive': '#808000',
  'Multicolor': '#FF0000',
  'Black & White': '#000000',
  'Transparent': '#FFFFFF'
  
};

export default function NewProductPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [mainCategories, setMainCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<Category[]>([])
  const [subSubCategories, setSubSubCategories] = useState<Category[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState(false)
  const [currentVariantForGoogleDrive, setCurrentVariantForGoogleDrive] = useState<string | null>(null)
  const [showGoogleDriveVideoPicker, setShowGoogleDriveVideoPicker] = useState(false)
  const [currentVariantForGoogleDriveVideo, setCurrentVariantForGoogleDriveVideo] = useState<string | null>(null)

  const [formData, setFormData] = useState<ProductFormData>({
    brand: '',
    category: '',
    subcategory: '',
    subsubcategory: '',
    colors: [],
    colorVariants: [],
    descriptionEn: '',
    descriptionHe: '',
    featured: false,
    nameEn: '',
    nameHe: '',
    new: false,
    price: 0,
    saleEndDate: '',
    salePrice: 0,
    saleStartDate: '',
    baseSku: '',
    currency: 'ILS',
    
    // Material & Care fields
    upperMaterialEn: '',
    upperMaterialHe: '',
    materialInnerSoleEn: '',
    materialInnerSoleHe: '',
    liningEn: '',
    liningHe: '',
    soleEn: '',
    soleHe: '',
    heelHeightEn: '',
    heelHeightHe: '',
    
    // Shipping & Returns field
    shippingReturnsEn: '',
    shippingReturnsHe: ''
  })

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await categoryService.getAllCategories()
        setCategories(cats)
        
        // Filter main categories (level 0) that are enabled
        const mainCats = cats.filter(cat => cat.level === 0 && cat.isEnabled)
        setMainCategories(mainCats)
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }
    fetchCategories()
  }, [])

  const handleInputChange = (field: keyof ProductFormData, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
  }

  const handleCategoryChange = async (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      category: categoryId,
      subcategory: '', // Reset subcategory
      subsubcategory: '' // Reset sub-subcategory
    }))
    
    // Clear subcategory and sub-subcategory selections
    setSubCategories([])
    setSubSubCategories([])
    
    // Clear errors
    setErrors(prev => ({
      ...prev,
      category: undefined,
      subcategory: undefined,
      subsubcategory: undefined
    }))
    
    if (categoryId) {
      try {
        // Fetch subcategories for the selected main category
        const subCats = await categoryService.getSubCategories(categoryId)
        const enabledSubCats = subCats.filter(cat => cat.isEnabled)
        setSubCategories(enabledSubCats)
      } catch (error) {
        console.error('Error fetching subcategories:', error)
      }
    }
  }

  const handleSubCategoryChange = async (subCategoryId: string) => {
    setFormData(prev => ({
      ...prev,
      subcategory: subCategoryId,
      subsubcategory: '' // Reset sub-subcategory
    }))
    
    // Clear sub-subcategory selections
    setSubSubCategories([])
    
    // Clear errors
    setErrors(prev => ({
      ...prev,
      subcategory: undefined,
      subsubcategory: undefined
    }))
    
    if (subCategoryId) {
      try {
        // Fetch sub-subcategories for the selected subcategory
        const subSubCats = await categoryService.getSubCategories(subCategoryId)
        const enabledSubSubCats = subSubCats.filter(cat => cat.isEnabled)
        setSubSubCategories(enabledSubSubCats)
      } catch (error) {
        console.error('Error fetching sub-subcategories:', error)
      }
    }
  }

  const handleSubSubCategoryChange = (subSubCategoryId: string) => {
    setFormData(prev => ({
      ...prev,
      subsubcategory: subSubCategoryId
    }))
    
    // Clear error
    setErrors(prev => ({
      ...prev,
      subsubcategory: undefined
    }))
  }


  const handleArrayChange = (field: 'colors', value: string) => {
    const currentArray = formData[field]
    if (currentArray.includes(value)) {
      setFormData(prev => ({
        ...prev,
        [field]: currentArray.filter(item => item !== value)
      }))
      } else {
      setFormData(prev => ({
        ...prev,
        [field]: [...currentArray, value]
      }))
    }
  }

  // Generate color slug from color name
  const generateColorSlug = (colorName: string): string => {
    return colorName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  // Handle color selection - create/update color variants
  const handleColorSelection = (colorName: string, isSelected: boolean) => {
    if (isSelected) {
      // Add color to selected colors
    setFormData(prev => ({
      ...prev,
        colors: [...prev.colors, colorName]
      }))

      // Create color variant if it doesn't exist
      const existingVariant = formData.colorVariants.find(v => v.colorName === colorName)
      if (!existingVariant) {
        const newVariant: ColorVariantData = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          colorName,
          colorSlug: generateColorSlug(colorName),
          colorHex: colorHexMap[colorName] || '#000000',
          stock: 0,
          isActive: true,
          images: [],
          video: null,
          sizes: [...commonSizes],
          stockBySize: {}
        }
        
      setFormData(prev => ({
        ...prev,
          colorVariants: [...prev.colorVariants, newVariant]
      }))
      }
    } else {
      // Remove color from selected colors
      setFormData(prev => ({
        ...prev,
        colors: prev.colors.filter(c => c !== colorName)
      }))

      // Remove color variant
      setFormData(prev => ({
        ...prev,
        colorVariants: prev.colorVariants.filter(v => v.colorName !== colorName)
      }))
    }
  }

  // Update color variant data
  const updateColorVariant = (variantId: string, updates: Partial<ColorVariantData>) => {
    setFormData(prev => ({
      ...prev,
      colorVariants: prev.colorVariants.map(variant => 
        variant.id === variantId ? { ...variant, ...updates } : variant
      )
    }))
  }

  // Handle variant size stock change
  const handleVariantSizeStockChange = (variantId: string, size: string, stock: number) => {
    updateColorVariant(variantId, {
      stockBySize: {
        ...formData.colorVariants.find(v => v.id === variantId)?.stockBySize,
        [size]: stock
      }
    })
  }

  // Handle variant image selection
  const handleVariantImageSelect = (variantId: string, files: FileList | null) => {
    if (!files) return;
    
    const variant = formData.colorVariants.find(v => v.id === variantId);
    const existingImages = variant?.images || [];
    const hasExistingImages = existingImages.length > 0;
    
    const newImages: ImageFile[] = Array.from(files).map((file, index) => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
      isPrimary: !hasExistingImages && index === 0 // Set first new image as primary if no existing images
    }));
    
    updateColorVariant(variantId, {
      images: [...existingImages, ...newImages]
    });
  };

  // Remove variant image
  const removeVariantImage = (variantId: string, index: number) => {
    const variant = formData.colorVariants.find(v => v.id === variantId);
    if (!variant) return;

    const imageToRemove = variant.images[index];
    const updatedImages = variant.images.filter((_, i) => i !== index);
    
    // If we removed the primary image, set the first remaining image as primary
    if (imageToRemove.isPrimary && updatedImages.length > 0) {
      updatedImages[0].isPrimary = true;
    }
    
    updateColorVariant(variantId, { images: updatedImages });
  };

  // Handle variant video selection
  const handleVariantVideoSelect = (variantId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('video/mp4')) {
      alert('Please select an MP4 video file');
      return;
    }
    
    // Validate file size (2.5MB = 2.5 * 1024 * 1024 bytes)
    const maxSize = 2.5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Video file size must not exceed 2.5MB');
      return;
    }
    
    const videoFile: VideoFile = {
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false
    };
    
    updateColorVariant(variantId, { video: videoFile });
  };

  // Remove variant video
  const removeVariantVideo = (variantId: string) => {
    updateColorVariant(variantId, { video: null });
  };

  // Handle Google Drive file selection
  const handleGoogleDriveSelect = async (files: any[]) => {
    if (!currentVariantForGoogleDrive) return;

    try {
      if (files.length === 0) {
        alert('Please select at least one image to import.');
        return;
      }

      // Show loading state
      const loadingVariant = formData.colorVariants.find(v => v.id === currentVariantForGoogleDrive);
      if (loadingVariant) {
        updateColorVariant(currentVariantForGoogleDrive, {
          images: loadingVariant.images.map(img => ({ ...img, uploading: true }))
        });
      }

      // Download files from Google Drive
      const response = await fetch('/api/google-drive/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: files.map(file => file.id)
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.files || data.files.length === 0) {
        throw new Error('No files were downloaded successfully');
      }

      // Convert base64 content to File objects
      const importingVariant = formData.colorVariants.find(v => v.id === currentVariantForGoogleDrive);
      const existingImages = importingVariant?.images || [];
      const hasExistingImages = existingImages.length > 0;
      
      const newImages: ImageFile[] = data.files.map((file: any, index: number) => {
        try {
          // Convert base64 to blob
          const byteCharacters = atob(file.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: file.mimeType });
          
          // Create File object
          const fileObj = new File([blob], file.name, { type: file.mimeType });
          
          return {
            file: fileObj,
            preview: URL.createObjectURL(blob),
            uploading: false,
            uploaded: false,
            isPrimary: !hasExistingImages && index === 0 // Set first new image as primary if no existing images
          };
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          return null;
        }
      }).filter(Boolean) as ImageFile[];

      if (newImages.length === 0) {
        throw new Error('No valid images could be processed');
      }

      // Add images to the current variant
      updateColorVariant(currentVariantForGoogleDrive, {
        images: [
          ...formData.colorVariants.find(v => v.id === currentVariantForGoogleDrive)?.images || [],
          ...newImages
        ]
      });

      setShowGoogleDrivePicker(false);
      setCurrentVariantForGoogleDrive(null);

      // Show success message
      alert(`Successfully imported ${newImages.length} image(s) from Google Drive!`);
    } catch (error) {
      console.error('Error importing from Google Drive:', error);
      
      // Reset uploading state
      const errorVariant = formData.colorVariants.find(v => v.id === currentVariantForGoogleDrive);
      if (errorVariant) {
        updateColorVariant(currentVariantForGoogleDrive, {
          images: errorVariant.images.map(img => ({ ...img, uploading: false }))
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to import images from Google Drive: ${errorMessage}`);
    }
  };

  // Handle Google Drive video selection
  const handleGoogleDriveVideoSelect = async (files: any[]) => {
    if (!currentVariantForGoogleDriveVideo) return;

    try {
      if (files.length === 0) {
        alert('Please select a video to import.');
        return;
      }

      if (files.length > 1) {
        alert('Please select only one video file.');
        return;
      }

      const file = files[0];
      
      // Check if it's a video file
      if (!file.mimeType.startsWith('video/')) {
        alert('Please select a video file.');
        return;
      }

      // Check file size (2.5MB limit)
      if (file.size > 2.5 * 1024 * 1024) {
        alert('Video file size must not exceed 2.5MB');
        return;
      }

      // Show loading state
      const loadingVariant = formData.colorVariants.find(v => v.id === currentVariantForGoogleDriveVideo);
      if (loadingVariant) {
        updateColorVariant(currentVariantForGoogleDriveVideo, {
          video: { 
            file: new File([], 'loading'), 
            preview: '', 
            uploading: true, 
            uploaded: false 
          }
        });
      }

      // Download file from Google Drive
      const response = await fetch('/api/google-drive/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: [file.id]
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.files || data.files.length === 0) {
        throw new Error('Video file was not downloaded successfully');
      }

      // Convert base64 content to File object
      const videoData = data.files[0];
      try {
        // Convert base64 to blob
        const byteCharacters = atob(videoData.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: videoData.mimeType });
        
        // Create File object
        const videoFile = new File([blob], videoData.name, { type: videoData.mimeType });
        
        // Create preview URL
        const previewUrl = URL.createObjectURL(videoFile);

        // Update the variant with the new video
        const videoFileData: VideoFile = {
          file: videoFile,
          preview: previewUrl,
          uploading: false,
          uploaded: false
        };

        updateColorVariant(currentVariantForGoogleDriveVideo, { video: videoFileData });

        // Close the picker
        setShowGoogleDriveVideoPicker(false);
        setCurrentVariantForGoogleDriveVideo(null);

        alert('Video imported successfully from Google Drive!');
      } catch (conversionError) {
        console.error('Error converting video file:', conversionError);
        throw new Error('Failed to process video file');
      }
    } catch (error) {
      console.error('Error importing video from Google Drive:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to import video from Google Drive: ${errorMessage}`);
      
      // Reset video state on error
      if (currentVariantForGoogleDriveVideo) {
        updateColorVariant(currentVariantForGoogleDriveVideo, { video: null });
      }
    }
  };

  // Open Google Drive picker for a specific variant
  const openGoogleDrivePicker = (variantId: string) => {
    setCurrentVariantForGoogleDrive(variantId);
    setShowGoogleDrivePicker(true);
  };

  // Open Google Drive video picker for a specific variant
  const openGoogleDriveVideoPicker = (variantId: string) => {
    setCurrentVariantForGoogleDriveVideo(variantId);
    setShowGoogleDriveVideoPicker(true);
  };

  // Set primary image for a variant
  const setPrimaryImage = (variantId: string, imageIndex: number) => {
    const variant = formData.colorVariants.find(v => v.id === variantId);
    if (!variant) return;

    // Update all images to set isPrimary correctly
    const updatedImages = variant.images.map((img, index) => ({
      ...img,
      isPrimary: index === imageIndex
    }));

    updateColorVariant(variantId, { images: updatedImages });
  };

  // Upload variant images
  const uploadVariantImages = async (variantId: string): Promise<string[]> => {
    const variant = formData.colorVariants.find(v => v.id === variantId);
    if (!variant) return [];

    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < variant.images.length; i++) {
      const imageFile = variant.images[i];
      if (imageFile.uploaded && imageFile.url) {
        uploadedUrls.push(imageFile.url);
        continue;
      }

      try {
        // Mark as uploading
        updateColorVariant(variantId, {
          images: variant.images.map((img, idx) => 
            idx === i ? { ...img, uploading: true } : img
          )
        });

        // Upload to Firebase Storage
        const fileName = `products/${formData.baseSku}/${variant.colorSlug}/${Date.now()}-${i}-${imageFile.file.name}`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, imageFile.file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Mark as uploaded
        updateColorVariant(variantId, {
          images: variant.images.map((img, idx) => 
            idx === i ? { ...img, uploading: false, uploaded: true, url: downloadURL } : img
          )
        });

        uploadedUrls.push(downloadURL);
      } catch (error) {
        console.error('Error uploading variant image:', error);
        // Mark as failed
        updateColorVariant(variantId, {
          images: variant.images.map((img, idx) => 
            idx === i ? { ...img, uploading: false } : img
          )
        });
      }
    }

    return uploadedUrls;
  };

  // Upload variant video
  const uploadVariantVideo = async (variantId: string): Promise<string | null> => {
    const variant = formData.colorVariants.find(v => v.id === variantId);
    if (!variant || !variant.video) return null;
    
    const videoFile = variant.video;
    if (videoFile.uploaded && videoFile.url) {
      return videoFile.url;
    }

    try {
      // Mark as uploading
      updateColorVariant(variantId, {
        video: { ...videoFile, uploading: true }
      });

      // Upload to Firebase Storage
      const fileName = `products/${formData.baseSku}/${variant.colorSlug}/video/${Date.now()}-${videoFile.file.name}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, videoFile.file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Mark as uploaded
      updateColorVariant(variantId, {
        video: { ...videoFile, uploading: false, uploaded: true, url: downloadURL }
      });

      return downloadURL;
    } catch (error) {
      console.error('Error uploading variant video:', error);
      // Mark as failed
      updateColorVariant(variantId, {
        video: { ...videoFile, uploading: false }
      });
      return null;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.nameEn.trim()) {
      newErrors.nameEn = 'English name is required'
    }
    if (!formData.nameHe.trim()) {
      newErrors.nameHe = 'Hebrew name is required'
    }
    if (!formData.descriptionEn.trim()) {
      newErrors.descriptionEn = 'English description is required'
    }
    if (!formData.descriptionHe.trim()) {
      newErrors.descriptionHe = 'Hebrew description is required'
    }
    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0'
    }
    if (!formData.brand.trim()) {
      newErrors.brand = 'Brand is required'
    }
    if (!formData.category.trim()) {
      newErrors.category = 'Main category is required'
    }
    // Note: subcategory and sub-subcategory are optional
    // Users can select just a main category, or go deeper into the hierarchy
    if (formData.colors.length === 0) {
      newErrors.colors = 'At least one color is required'
    }
    if (!formData.baseSku.trim()) {
      newErrors.baseSku = 'Base SKU is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('Form submission started')
    
    if (!validateForm()) {
      console.log('Form validation failed')
      return
    }

    console.log('Form validation passed, starting submission')
    setIsSubmitting(true)
    
    try {
      
      console.log('Preparing product data...')
      
      // Use the main category ID for categoryId (for backward compatibility)
      const selectedCategoryId = formData.category;
      let selectedCategoryPath = '';
      
      // Find the deepest category object for path generation
      let deepestCategoryId = formData.category;
      if (formData.subsubcategory) {
        deepestCategoryId = formData.subsubcategory;
      } else if (formData.subcategory) {
        deepestCategoryId = formData.subcategory;
      }
      
      const selectedCategoryObj = categories.find(cat => cat.id === selectedCategoryId);
      const deepestCategoryObj = categories.find(cat => cat.id === deepestCategoryId);
      
      // Build the full category path for hierarchical collection routing
      if (deepestCategoryObj && deepestCategoryObj.path) {
        selectedCategoryPath = deepestCategoryObj.path;
      } else {
        // Fallback: build path from the category hierarchy
        const mainCategory = categories.find(cat => cat.id === formData.category);
        const subCategory = formData.subcategory ? categories.find(cat => cat.id === formData.subcategory) : null;
        const subSubCategory = formData.subsubcategory ? categories.find(cat => cat.id === formData.subsubcategory) : null;
        
        if (mainCategory) {
          const mainSlug = typeof mainCategory.slug === 'object' ? mainCategory.slug.en : mainCategory.slug;
          selectedCategoryPath = mainSlug;
          
          if (subCategory) {
            const subSlug = typeof subCategory.slug === 'object' ? subCategory.slug.en : subCategory.slug;
            selectedCategoryPath += `/${subSlug}`;
            
            if (subSubCategory) {
              const subSubSlug = typeof subSubCategory.slug === 'object' ? subSubCategory.slug.en : subSubCategory.slug;
              selectedCategoryPath += `/${subSubSlug}`;
            }
          }
        }
      }


      const productData: any = {
        name: {
          en: formData.nameEn,
          he: formData.nameHe
        },
        slug: {
          en: formData.nameEn.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim(),
          he: formData.nameHe.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
        },
        categorySlug: (() => {
          // For backward compatibility, categorySlug should be the main category slug
          const mainCategoryObj = categories.find(cat => cat.id === formData.category);
          return mainCategoryObj ? (typeof mainCategoryObj.slug === 'string' ? mainCategoryObj.slug : mainCategoryObj.slug?.en || '') : '';
        })(),
        categoryPath: selectedCategoryPath, // Full hierarchical path for collection routing
        description: {
          en: formData.descriptionEn,
          he: formData.descriptionHe
        },
        price: parseFloat(formData.price.toString()),
        stock: 0, // Base product has no stock - stock is managed per color variant
        featured: formData.featured,
        isNew: formData.new,
        isActive: true,
        categoryId: formData.category,
        images: [], // No base product images - each color variant has its own images
        variants: [], // Empty array for now
        tags: [], // Empty array for now
        colors: formData.colors, // Add colors
        brand: formData.brand, // Add brand
        subcategory: formData.subcategory, // Add subcategory
        currency: formData.currency,
        
        // Material & Care fields (only include if they have values)
        ...(formData.upperMaterialEn || formData.upperMaterialHe ? {
          upperMaterial: {
            en: formData.upperMaterialEn,
            he: formData.upperMaterialHe
          }
        } : {}),
        ...(formData.materialInnerSoleEn || formData.materialInnerSoleHe ? {
          materialInnerSole: {
            en: formData.materialInnerSoleEn,
            he: formData.materialInnerSoleHe
          }
        } : {}),
        ...(formData.liningEn || formData.liningHe ? {
          lining: {
            en: formData.liningEn,
            he: formData.liningHe
          }
        } : {}),
        ...(formData.soleEn || formData.soleHe ? {
          sole: {
            en: formData.soleEn,
            he: formData.soleHe
          }
        } : {}),
        ...(formData.heelHeightEn || formData.heelHeightHe ? {
          heelHeight: {
            en: formData.heelHeightEn,
            he: formData.heelHeightHe
          }
        } : {}),
        
        // Shipping & Returns field (only include if it has values)
        ...(formData.shippingReturnsEn || formData.shippingReturnsHe ? {
          shippingReturns: {
            en: formData.shippingReturnsEn,
            he: formData.shippingReturnsHe
          }
        } : {})
      }

      // Only add optional fields if they have valid values
      if (formData.salePrice > 0) {
        productData.salePrice = parseFloat(formData.salePrice.toString())
      }
      
      if (formData.saleStartDate) {
        productData.saleStartDate = new Date(formData.saleStartDate)
      }
      
      if (formData.saleEndDate) {
        productData.saleEndDate = new Date(formData.saleEndDate)
      }
      
      // Base SKU is required and validated, so always include it
      productData.baseSku = formData.baseSku.trim()
      // Also set sku for backward compatibility with existing URL routing
      productData.sku = formData.baseSku.trim()

      console.log('Product data prepared:', productData)
      console.log('Calling productService.createProduct...')
      
      const createdProductId = await productService.createProduct(productData)
      console.log('Product created successfully:', createdProductId)
      
      // Create color variants
      if (formData.colorVariants.length > 0) {
        console.log('Creating color variants...')
        for (const variantData of formData.colorVariants) {
          // Upload variant images
          const variantImageUrls = await uploadVariantImages(variantData.id)
          
          // Upload variant video if present
          let videoUrl: string | null = null;
          if (variantData.video) {
            console.log(`Uploading video for ${variantData.colorName} variant...`)
            videoUrl = await uploadVariantVideo(variantData.id)
          }
          
          // Create color variant
          const colorVariantData: any = {
            productId: createdProductId,
            colorName: variantData.colorName,
            colorSlug: variantData.colorSlug,
            colorHex: variantData.colorHex,
            price: variantData.price || productData.price,
            stock: variantData.stock,
            isActive: variantData.isActive,
            createdAt: new Date(),
            updatedAt: new Date()
          }

          // Only add videoUrl if it has a value
          if (videoUrl) {
            colorVariantData.videoUrl = videoUrl
          }

          // Only add optional fields if they have values
          if (variantData.salePrice && variantData.salePrice > 0) {
            colorVariantData.salePrice = variantData.salePrice
          }
          if (variantData.saleStartDate && variantData.saleStartDate.trim()) {
            colorVariantData.saleStartDate = new Date(variantData.saleStartDate)
          }
          if (variantData.saleEndDate && variantData.saleEndDate.trim()) {
            colorVariantData.saleEndDate = new Date(variantData.saleEndDate)
          }
          if (variantData.metaTitle && variantData.metaTitle.trim()) {
            colorVariantData.metaTitle = variantData.metaTitle
          }
          if (variantData.metaDescription && variantData.metaDescription.trim()) {
            colorVariantData.metaDescription = variantData.metaDescription
          }
          
          const colorVariant = await colorVariantService.createColorVariant(colorVariantData)
          console.log('Color variant created:', colorVariant)
          
          // Create variant images
          for (let i = 0; i < variantImageUrls.length; i++) {
            const imageData = variantData.images[i];
            await colorVariantService.addColorVariantImage(colorVariant, {
              url: variantImageUrls[i],
              alt: `${productData.name.en} - ${variantData.colorName} - Image ${i + 1}`,
              isPrimary: imageData.isPrimary || false,
              order: i
            })
          }
          
          // Create variant sizes
          for (const size of variantData.sizes) {
            const stock = variantData.stockBySize[size] || 0
            const sizeSku = `${formData.baseSku}-${variantData.colorSlug}-${size}`
            
            await colorVariantService.addColorVariantSize(colorVariant, {
              size,
              stock,
              sku: sizeSku
            })
          }
        }
        console.log('All color variants created successfully')
      }
      
      setShowSuccess(true)
      setTimeout(() => {
        router.push('/admin/products')
      }, 2000)
          } catch (error: unknown) {
      console.error('Error adding product:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Error adding product: ${errorMessage}`)
    } finally {
      console.log('Setting isSubmitting to false')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create a new product with all required information
            </p>
          </div>

          {showSuccess && (
            <SuccessMessage 
              message="Product created successfully! Redirecting to products page..." 
              onClose={() => setShowSuccess(false)}
            />
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="nameEn" className="block text-sm font-medium text-gray-700">
                    Product Name (English) *
                  </label>
                  <input
                    type="text"
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => handleInputChange('nameEn', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.nameEn ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter product name in English"
                  />
                  {errors.nameEn && <p className="mt-1 text-sm text-red-600">{errors.nameEn}</p>}
                </div>

                <div>
                  <label htmlFor="nameHe" className="block text-sm font-medium text-gray-700">
                    Product Name (Hebrew) *
                  </label>
                  <input
                    type="text"
                    id="nameHe"
                    value={formData.nameHe}
                    onChange={(e) => handleInputChange('nameHe', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.nameHe ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter product name in Hebrew"
                  />
                  {errors.nameHe && <p className="mt-1 text-sm text-red-600">{errors.nameHe}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="descriptionEn" className="block text-sm font-medium text-gray-700">
                    Description (English) *
                  </label>
                  <textarea
                    id="descriptionEn"
                    rows={3}
                    value={formData.descriptionEn}
                    onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.descriptionEn ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter product description in English"
                  />
                  {errors.descriptionEn && <p className="mt-1 text-sm text-red-600">{errors.descriptionEn}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="descriptionHe" className="block text-sm font-medium text-gray-700">
                    Description (Hebrew) *
                  </label>
                  <textarea
                    id="descriptionHe"
                    rows={3}
                    value={formData.descriptionHe}
                    onChange={(e) => handleInputChange('descriptionHe', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.descriptionHe ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter product description in Hebrew"
                  />
                  {errors.descriptionHe && <p className="mt-1 text-sm text-red-600">{errors.descriptionHe}</p>}
                </div>

                {/* Material & Care Section */}
                <div className="sm:col-span-2">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Material & Care</h3>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* Upper Material */}
                    <div>
                      <label htmlFor="upperMaterialEn" className="block text-sm font-medium text-gray-700">
                        Upper Material (English)
                      </label>
                      <input
                        type="text"
                        id="upperMaterialEn"
                        value={formData.upperMaterialEn}
                        onChange={(e) => handleInputChange('upperMaterialEn', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="e.g., Leather Combination"
                      />
                    </div>
                    <div>
                      <label htmlFor="upperMaterialHe" className="block text-sm font-medium text-gray-700">
                        Upper Material (Hebrew)
                      </label>
                      <input
                        type="text"
                        id="upperMaterialHe"
                        value={formData.upperMaterialHe}
                        onChange={(e) => handleInputChange('upperMaterialHe', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="לדוגמה: שילוב עור"
                      />
                    </div>

                    {/* Material Inner Sole */}
                    <div>
                      <label htmlFor="materialInnerSoleEn" className="block text-sm font-medium text-gray-700">
                        Material Inner Sole (English)
                      </label>
                      <input
                        type="text"
                        id="materialInnerSoleEn"
                        value={formData.materialInnerSoleEn}
                        onChange={(e) => handleInputChange('materialInnerSoleEn', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="e.g., Leather"
                      />
                    </div>
                    <div>
                      <label htmlFor="materialInnerSoleHe" className="block text-sm font-medium text-gray-700">
                        Material Inner Sole (Hebrew)
                      </label>
                      <input
                        type="text"
                        id="materialInnerSoleHe"
                        value={formData.materialInnerSoleHe}
                        onChange={(e) => handleInputChange('materialInnerSoleHe', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="לדוגמה: עור"
                      />
                    </div>

                    {/* Lining */}
                    <div>
                      <label htmlFor="liningEn" className="block text-sm font-medium text-gray-700">
                        Lining (English)
                      </label>
                      <input
                        type="text"
                        id="liningEn"
                        value={formData.liningEn}
                        onChange={(e) => handleInputChange('liningEn', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="e.g., 100% Textile"
                      />
                    </div>
                    <div>
                      <label htmlFor="liningHe" className="block text-sm font-medium text-gray-700">
                        Lining (Hebrew)
                      </label>
                      <input
                        type="text"
                        id="liningHe"
                        value={formData.liningHe}
                        onChange={(e) => handleInputChange('liningHe', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="לדוגמה: 100% טקסטיל"
                      />
                    </div>

                    {/* Sole */}
                    <div>
                      <label htmlFor="soleEn" className="block text-sm font-medium text-gray-700">
                        Sole (English)
                      </label>
                      <input
                        type="text"
                        id="soleEn"
                        value={formData.soleEn}
                        onChange={(e) => handleInputChange('soleEn', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="e.g., Rubber Sole"
                      />
                    </div>
                    <div>
                      <label htmlFor="soleHe" className="block text-sm font-medium text-gray-700">
                        Sole (Hebrew)
                      </label>
                      <input
                        type="text"
                        id="soleHe"
                        value={formData.soleHe}
                        onChange={(e) => handleInputChange('soleHe', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="לדוגמה: סוליה מגומי"
                      />
                    </div>

                    {/* Heel Height */}
                    <div>
                      <label htmlFor="heelHeightEn" className="block text-sm font-medium text-gray-700">
                        Heel Height (English)
                      </label>
                      <input
                        type="text"
                        id="heelHeightEn"
                        value={formData.heelHeightEn}
                        onChange={(e) => handleInputChange('heelHeightEn', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="e.g., 5cm"
                      />
                    </div>
                    <div>
                      <label htmlFor="heelHeightHe" className="block text-sm font-medium text-gray-700">
                        Heel Height (Hebrew)
                      </label>
                      <input
                        type="text"
                        id="heelHeightHe"
                        value={formData.heelHeightHe}
                        onChange={(e) => handleInputChange('heelHeightHe', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                        placeholder="לדוגמה: 5 ס״מ"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
                    Brand *
                  </label>
                  <input
                    type="text"
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.brand ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter brand name"
                  />
                  {errors.brand && <p className="mt-1 text-sm text-red-600">{errors.brand}</p>}
                </div>

                <div>
                  <label htmlFor="baseSku" className="block text-sm font-medium text-gray-700">
                    Base SKU *
                  </label>
                  <input
                    type="text"
                    id="baseSku"
                    value={formData.baseSku}
                    onChange={(e) => handleInputChange('baseSku', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.baseSku ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Base SKU for product family (e.g., OXF-001)"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    This will be used to generate URLs like /product/{formData.baseSku || 'OXF-001'}/black
                  </p>
                  {errors.baseSku && <p className="mt-1 text-sm text-red-600">{errors.baseSku}</p>}
                </div>

              </div>
            </div>


            {/* Pricing */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Pricing</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                    Price *
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">₪</span>
                    </div>
                    <input
                      type="number"
                      id="price"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      className={`block w-full pl-7 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-900 ${
                        errors.price ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
                </div>

                <div>
                  <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700">
                    Sale Price
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">₪</span>
                    </div>
                    <input
                      type="number"
                      id="salePrice"
                      step="0.01"
                      min="0"
                      value={formData.salePrice}
                      onChange={(e) => handleInputChange('salePrice', e.target.value)}
                      className={`block w-full pl-7 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-900 ${
                        errors.price ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                </div>


                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                    Currency
                  </label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  >
                    <option value="ILS">ILS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              {/* Sale Dates */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-6">
                <div>
                  <label htmlFor="saleStartDate" className="block text-sm font-medium text-gray-700">
                    Sale Start Date
                  </label>
                  <input
                    type="date"
                    id="saleStartDate"
                    value={formData.saleStartDate}
                    onChange={(e) => handleInputChange('saleStartDate', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>

                <div>
                  <label htmlFor="saleEndDate" className="block text-sm font-medium text-gray-700">
                    Sale End Date
                  </label>
                  <input
                    type="date"
                    id="saleEndDate"
                    value={formData.saleEndDate}
                    onChange={(e) => handleInputChange('saleEndDate', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Categories</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                    Main Category *
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 ${
                      errors.category ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="" className="text-gray-600">Select a main category</option>
                    {mainCategories.map((category) => (
                      <option key={category.id} value={category.id} className="text-gray-900">
                        {typeof category.name === 'object' ? category.name.en : category.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
                </div>

                {formData.category && subCategories.length > 0 && (
                  <div>
                    <label htmlFor="subcategory" className="block text-sm font-medium text-gray-700">
                      Sub Category
                    </label>
                    <select
                      id="subcategory"
                      value={formData.subcategory}
                      onChange={(e) => handleSubCategoryChange(e.target.value)}
                      className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 ${
                        errors.subcategory ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="" className="text-gray-600">Select a sub category (optional)</option>
                      {subCategories.map((category) => (
                        <option key={category.id} value={category.id} className="text-gray-900">
                          {typeof category.name === 'object' ? category.name.en : category.name}
                        </option>
                      ))}
                    </select>
                    {errors.subcategory && <p className="mt-1 text-sm text-red-600">{errors.subcategory}</p>}
                  </div>
                )}

                {formData.subcategory && subSubCategories.length > 0 && (
                  <div>
                    <label htmlFor="subsubcategory" className="block text-sm font-medium text-gray-700">
                      Sub-Sub Category
                    </label>
                    <select
                      id="subsubcategory"
                      value={formData.subsubcategory}
                      onChange={(e) => handleSubSubCategoryChange(e.target.value)}
                      className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 ${
                        errors.subsubcategory ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="" className="text-gray-600">Select a sub-sub category (optional)</option>
                      {subSubCategories.map((category) => (
                        <option key={category.id} value={category.id} className="text-gray-900">
                          {typeof category.name === 'object' ? category.name.en : category.name}
                        </option>
                      ))}
                    </select>
                    {errors.subsubcategory && <p className="mt-1 text-sm text-red-600">{errors.subsubcategory}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Colors */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Colors *</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {commonColors.map((color) => (
                  <label key={color} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.colors.includes(color)}
                      onChange={(e) => handleColorSelection(color, e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded border border-gray-300"
                        style={{ backgroundColor: colorHexMap[color] || '#000000' }}
                    />
                    <span className="text-sm text-gray-700">{color}</span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.colors && <p className="mt-2 text-sm text-red-600">{errors.colors}</p>}
            </div>

            {/* Color Variants */}
            {formData.colorVariants.length > 0 && (
            <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Color Variants</h2>
                <div className="space-y-6">
                  {formData.colorVariants.map((variant) => (
                    <div key={variant.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: variant.colorHex }}
                          />
                          <h3 className="text-lg font-medium text-gray-900">{variant.colorName}</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                              checked={variant.isActive}
                              onChange={(e) => updateColorVariant(variant.id, { isActive: e.target.checked })}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                            <span className="text-sm text-gray-700">Active</span>
                    </label>
                        </div>
                </div>
                
                      {/* URL Preview */}
                      <div className="mb-4 p-3 bg-white border border-gray-200 rounded-md">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Preview URL
                        </label>
                        <div className="flex items-center space-x-2">
                          <code className="text-sm bg-gray-400 text-white px-2 py-1 rounded">
                            /product/{formData.baseSku || 'baseSku'}/{variant.colorSlug}
                          </code>
                          <button
                            type="button"
                            onClick={() => window.open(`/product/${formData.baseSku}/${variant.colorSlug}`, '_blank')}
                            className="text-sm text-indigo-600 hover:text-indigo-800"
                            disabled={!formData.baseSku}
                          >
                            Preview
                          </button>
                        </div>
                      </div>

                      {/* Color Slug */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Color Slug
                        </label>
                        <input
                          type="text"
                          value={variant.colorSlug}
                          onChange={(e) => updateColorVariant(variant.id, { colorSlug: e.target.value })}
                          className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="URL-friendly slug"
                        />
                      </div>

                      {/* Pricing */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price Override (optional)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={variant.price || ''}
                            onChange={(e) => updateColorVariant(variant.id, { price: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Leave empty to use base price"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sale Price (optional)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={variant.salePrice || ''}
                            onChange={(e) => updateColorVariant(variant.id, { salePrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Sale price for this color"
                          />
                        </div>
                      </div>

                      {/* Stock by Size */}
                      {variant.sizes.length > 0 && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Stock by Size
                          </label>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {variant.sizes.map((size: string) => (
                              <div key={size} className="text-center">
                                <label className="block text-xs text-gray-600 mb-1">{size}</label>
                                <input
                                  type="number"
                            min="0"
                                  value={variant.stockBySize[size] || 0}
                                  onChange={(e) => handleVariantSizeStockChange(variant.id, size, parseInt(e.target.value) || 0)}
                                  className="w-full text-gray-500 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                      {/* SEO Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Meta Title (optional)
                          </label>
                          <input
                            type="text"
                            value={variant.metaTitle || ''}
                            onChange={(e) => updateColorVariant(variant.id, { metaTitle: e.target.value })}
                            className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="SEO title for this color"
                          />
              </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Meta Description (optional)
                          </label>
                          <textarea
                            rows={2}
                            value={variant.metaDescription || ''}
                            onChange={(e) => updateColorVariant(variant.id, { metaDescription: e.target.value })}
                            className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="SEO description for this color"
                          />
                        </div>
            </div>

                      {/* Color Variant Images */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {variant.colorName} Images
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                          <div className="text-center">
                            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => handleVariantImageSelect(variant.id, e.target.files)}
                                className="hidden"
                                id={`variant-images-${variant.id}`}
                              />
                              <label
                                htmlFor={`variant-images-${variant.id}`}
                                className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                              >
                                Upload {variant.colorName} Images
                              </label>
                              
                              <button
                                type="button"
                                onClick={() => openGoogleDrivePicker(variant.id)}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              >
                                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M7.71 6.71L6.29 5.29 12 0l5.71 5.29-1.42 1.42L13 3.83V15h-2V3.83L7.71 6.71z"/>
                                  <path d="M19 7h-8v2h8v10H5V9h8V7H3v14h18V7z"/>
                                </svg>
                                Import from Google Drive
                              </button>
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                              Upload images from your computer or import from Google Drive
                            </p>
                          </div>
                          
                          {/* Variant Image Preview */}
                          {variant.images.length > 0 && (
                            <div className="mt-4">
                              <div className="mb-3">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">
                                  Images ({variant.images.length})
                                </h4>
                                <p className="text-xs text-gray-500">
                                  Click on any image to set it as the primary image (shown on product page)
                                </p>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {variant.images.map((image, index) => (
                                  <div key={index} className="relative group">
                                    <div 
                                      className={`aspect-square relative overflow-hidden rounded-lg bg-gray-100 cursor-pointer transition-all duration-200 ${
                                        image.isPrimary 
                                          ? 'ring-2 ring-indigo-500 ring-offset-2' 
                                          : 'hover:ring-2 hover:ring-gray-300'
                                      }`}
                                      onClick={() => setPrimaryImage(variant.id, index)}
                                      title={image.isPrimary ? 'Primary image (click to change)' : 'Click to set as primary image'}
                                    >
                                      {image.uploading ? (
                                        <div className="flex items-center justify-center h-full">
                                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                        </div>
                                      ) : image.uploaded ? (
                                        <Image
                                          src={image.url || image.preview}
                                          alt={`${variant.colorName} - Image ${index + 1}`}
                                          fill
                                          className="object-cover"
                                        />
                                      ) : (
                                        <Image
                                          src={image.preview}
                                          alt={`${variant.colorName} - Image ${index + 1}`}
                                          fill
                                          className="object-cover"
                                        />
                                      )}
                                    </div>
                                    
                                    {/* Remove button */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeVariantImage(variant.id, index);
                                      }}
                                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Remove image"
                                    >
                                      ×
                                    </button>
                                    
                                    {/* Primary image indicator */}
                                    {image.isPrimary && (
                                      <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded font-medium">
                                        Primary
                                      </div>
                                    )}
                                    
                                    {/* Set as primary button for non-primary images */}
                                    {!image.isPrimary && (
                                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPrimaryImage(variant.id, index);
                                          }}
                                          className="w-full bg-indigo-600 text-white text-xs px-2 py-1 rounded hover:bg-indigo-700 transition-colors"
                                        >
                                          Set as Primary
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Color Variant Video */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {variant.colorName} Video (Optional)
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                          {!variant.video ? (
                            <div className="text-center">
                              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <input
                                  type="file"
                                  accept="video/mp4"
                                  onChange={(e) => handleVariantVideoSelect(variant.id, e.target.files)}
                                  className="hidden"
                                  id={`variant-video-${variant.id}`}
                                />
                                <label
                                  htmlFor={`variant-video-${variant.id}`}
                                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                                >
                                  Upload {variant.colorName} Video
                                </label>
                                <button
                                  type="button"
                                  onClick={() => openGoogleDriveVideoPicker(variant.id)}
                                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                  </svg>
                                  Import from Google Drive
                                </button>
                              </div>
                              <p className="mt-2 text-sm text-gray-500">
                                Upload a short video showcasing this color variant (MP4, max 2.5MB)
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {variant.video.file.name}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {(variant.video.file.size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {variant.video.uploading && (
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                                )}
                                {variant.video.uploaded && (
                                  <span className="text-sm text-green-600 font-medium">Uploaded</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeVariantVideo(variant.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* Flags */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Product Flags</h2>
              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => handleInputChange('featured', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Featured Product</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.new}
                    onChange={(e) => handleInputChange('new', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">New Product</span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/admin/products')}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Google Drive Picker Modal */}
      <GoogleDrivePicker
        isOpen={showGoogleDrivePicker}
        onClose={() => {
          setShowGoogleDrivePicker(false)
          setCurrentVariantForGoogleDrive(null)
        }}
        onSelectFiles={handleGoogleDriveSelect}
        multiple={true}
      />
      
      <GoogleDrivePicker
        isOpen={showGoogleDriveVideoPicker}
        onClose={() => {
          setShowGoogleDriveVideoPicker(false)
          setCurrentVariantForGoogleDriveVideo(null)
        }}
        onSelectFiles={handleGoogleDriveVideoSelect}
        multiple={false}
      />
    </div>
  )
} 